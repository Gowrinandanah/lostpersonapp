import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ── Generic helpers ──────────────────────────────────────────────────────────

export const addDocument = async (
  collectionName: string,
  data: DocumentData
) => {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getDocument = async (collectionName: string, docId: string) => {
  const snap = await getDoc(doc(db, collectionName, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateDocument = async (
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
) => {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteDocument = async (
  collectionName: string,
  docId: string
) => {
  await deleteDoc(doc(db, collectionName, docId));
};

export const getCollection = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeToCollection = (
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: DocumentData[]) => void
) => {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

// ── Missing persons ──────────────────────────────────────────────────────────

export const getMissingPersons = (
  callback: (data: DocumentData[]) => void
) => {
  return subscribeToCollection(
    "missingPersons",
    [where("status", "==", "active"), orderBy("createdAt", "desc")],
    callback
  );
};

// Admin: get ALL missing persons regardless of status
export const getAllMissingPersons = (
  callback: (data: DocumentData[]) => void
) => {
  return subscribeToCollection(
    "missingPersons",
    [orderBy("createdAt", "desc")],
    callback
  );
};

export const getMissingPersonById = (id: string) =>
  getDocument("missingPersons", id);

export const verifyCase = (id: string) =>
  updateDocument("missingPersons", id, { status: "active", verified: true });

export const rejectCase = (id: string) =>
  updateDocument("missingPersons", id, { status: "rejected", verified: false });

export const resolveCase = (id: string) =>
  updateDocument("missingPersons", id, { status: "resolved" });

// ── Sightings ────────────────────────────────────────────────────────────────

export const getSightingsForCase = (
  caseId: string,
  callback: (data: DocumentData[]) => void
) => {
  return subscribeToCollection(
    "sightings",
    [where("caseId", "==", caseId), orderBy("createdAt", "desc")],
    callback
  );
};

// ── Users ────────────────────────────────────────────────────────────────────

export const getUserProfile = (uid: string) =>
  getDocument("users", uid);

export const updateUserProfile = (uid: string, data: Partial<DocumentData>) =>
  updateDocument("users", uid, data);

// Admin: get all users
export const getAllUsers = (
  callback: (data: DocumentData[]) => void
) => {
  return subscribeToCollection(
    "users",
    [orderBy("createdAt", "desc")],
    callback
  );
};

export const banUser = (uid: string) =>
  updateDocument("users", uid, { banned: true });

export const unbanUser = (uid: string) =>
  updateDocument("users", uid, { banned: false });

export const promoteToAdmin = (uid: string) =>
  updateDocument("users", uid, { role: "admin" });

export const demoteFromAdmin = (uid: string) =>
  updateDocument("users", uid, { role: "user" });