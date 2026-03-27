// src/features/sightings/sightingService.ts
//
// All Firestore read/write operations for sighting reports.

import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { FaceComparisonPayload } from "../faceRecognition/faceService";

export interface SightingReport {
  id?: string;
  caseId: string;
  sightingLocation: string;
  sightingDate: string;
  description: string;
  confidence: "low" | "medium" | "high";
  contactPhone: string;
  photoUrl: string;
  coordinates: { latitude: number; longitude: number } | null;
  sightingLat: number | null;
  sightingLng: number | null;
  reportedBy: string;
  reportedByName: string;
  verified: boolean;
  createdAt?: Timestamp;

  // Face comparison fields
  faceMatchScore: number;
  faceMatchLabel: "high" | "medium" | "low";
  faceMatchColor: string;
  isSamePerson: boolean;
  faceMatchAttempted: boolean;
  faceMatchError: string | null;
}

// ── Save a new sighting report to Firestore ───────────────────────────────────
export async function saveSighting(
  sighting: Omit<SightingReport, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "sightings"), {
    ...sighting,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Get all sightings for a specific missing person case ──────────────────────
export async function getSightingsByCase(caseId: string): Promise<SightingReport[]> {
  const q = query(
    collection(db, "sightings"),
    where("caseId", "==", caseId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SightingReport));
}

// ── Get all sightings reported by a specific user ─────────────────────────────
export async function getSightingsByUser(uid: string): Promise<SightingReport[]> {
  const q = query(
    collection(db, "sightings"),
    where("reportedBy", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SightingReport));
}