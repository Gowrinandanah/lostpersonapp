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
  onSnapshot,
  serverTimestamp,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ── Generic helpers ──────────────────────────────────────────────────────────

export const addMissingPerson = async (data: DocumentData) => {
  const ref = await addDoc(collection(db, "missingPersons"), {
    ...data,
    status: "pending",
    verified: false,
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
  const ref  = doc(db, collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.warn(`updateDocument: ${collectionName}/${docId} not found, skipping`);
    return;
  }
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const deleteDocument = async (collectionName: string, docId: string) => {
  await deleteDoc(doc(db, collectionName, docId));
};

export const getCollection = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  const q    = query(collection(db, collectionName), ...constraints);
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

// ── Normalise verified field ─────────────────────────────────────────────────
const normaliseVerified = (raw: any): boolean => {
  if (typeof raw === "boolean") return raw;
  if (raw === "true")  return true;
  if (raw === "false") return false;
  return false;
};

// ── Missing persons ──────────────────────────────────────────────────────────

/** Alerts page: verified + active cases, real-time */
export const getMissingPersons = (callback: (data: DocumentData[]) => void) => {
  const q = query(
    collection(db, "missingPersons"),
    where("status", "==", "active"),   // single-field index — auto-created by Firestore
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
        verified: normaliseVerified(d.data().verified),
      }))
      .filter((p: any) => p.verified === true); // client-side verified check
    callback(results);
  });
};

/** Admin: all cases, real-time */
export const getAllCasesForAdmin = (callback: (data: DocumentData[]) => void) => {
  const q = query(
    collection(db, "missingPersons"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        verified: normaliseVerified(d.data().verified),
      }))
    );
  });
};

/** Map feed: verified + active/approved cases only, real-time */
export const getAllMissingPersons = (callback: (data: DocumentData[]) => void) => {
  const q = query(
    collection(db, "missingPersons"),
    where("status",   "in",  ["active", "approved"]),
    where("verified", "==",  true),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs
      .map((d) => ({ id: d.id, ...d.data(), verified: normaliseVerified(d.data().verified) }))
      .sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
    callback(results);
  });
};

/** Reporter view: cases belonging to a specific user, real-time */
export const getMyCases = (uid: string, callback: (data: DocumentData[]) => void) => {
  return subscribeToCollection(
    "missingPersons",
    [where("reportedBy", "==", uid), orderBy("createdAt", "desc")],
    callback
  );
};

export const getMissingPersonById = (id: string) => getDocument("missingPersons", id);

// ── Case actions ─────────────────────────────────────────────────────────────
// NOTE: verifyCase here is a plain Firestore write with NO notifications.
// Notifications are handled by verifyAndNotify() in alertsController.ts.
// verify-case.tsx should call verifyAndNotify(), not verifyCase().

export const verifyCase = async (id: string) => {
  const ref  = doc(db, "missingPersons", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { console.warn(`verifyCase: ${id} not found`); return; }
  await updateDoc(ref, { status: "active", verified: true, updatedAt: serverTimestamp() });
};

export const rejectCase = async (id: string) => {
  const ref  = doc(db, "missingPersons", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { console.warn(`rejectCase: ${id} not found`); return; }
  await updateDoc(ref, { status: "rejected", verified: false, updatedAt: serverTimestamp() });
};

export const resolveCase = async (id: string) => {
  const ref  = doc(db, "missingPersons", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { console.warn(`resolveCase: ${id} not found`); return; }
  await updateDoc(ref, { status: "resolved", updatedAt: serverTimestamp() });
};

// ── Sightings ────────────────────────────────────────────────────────────────

export const getSightingsForCase = (caseId: string, callback: (data: DocumentData[]) => void) => {
  return subscribeToCollection(
    "sightings",
    [where("caseId", "==", caseId), orderBy("createdAt", "desc")],
    callback
  );
};

export const getAllSightings = (callback: (data: DocumentData[]) => void) => {
  return subscribeToCollection("sightings", [orderBy("createdAt", "desc")], callback);
};

// ── Users ────────────────────────────────────────────────────────────────────

export const getUserProfile      = (uid: string) => getDocument("users", uid);
export const updateUserProfile   = (uid: string, data: Partial<DocumentData>) => updateDocument("users", uid, data);
export const getAllUsers          = (callback: (data: DocumentData[]) => void) =>
  subscribeToCollection("users", [orderBy("createdAt", "desc")], callback);

export const banUser         = (uid: string) => updateDocument("users", uid, { banned: true });
export const unbanUser       = (uid: string) => updateDocument("users", uid, { banned: false });
export const promoteToAdmin  = (uid: string) => updateDocument("users", uid, { role: "admin" });
export const demoteFromAdmin = (uid: string) => updateDocument("users", uid, { role: "user" });