// src/features/faceRecognition/faceService.ts
//
// Higher-level service that:
// 1. Takes the sighting image URL and the missing person's reference image URL
// 2. Calls faceMatcher to compare them
// 3. Returns a structured result ready to be saved to Firestore

import { compareFacesByUrl, FaceMatchResult, FaceMatchError } from "./faceMatcher";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

export interface FaceComparisonPayload {
  faceMatchScore: number;           // 0–100
  faceMatchLabel: "high" | "medium" | "low";
  faceMatchColor: string;
  isSamePerson: boolean;
  faceMatchAttempted: boolean;      // true even if it failed
  faceMatchError: string | null;    // null if successful
}

// ── Run face comparison for a sighting ───────────────────────────────────────
// caseId     — Firestore document ID of the missing person case
// sightingUrl — Cloudinary URL of the photo the responder just uploaded
export async function runFaceComparison(
  caseId: string,
  sightingUrl: string
): Promise<FaceComparisonPayload> {
  // Default payload — used if comparison fails
  const failed = (errorMsg: string): FaceComparisonPayload => ({
    faceMatchScore: 0,
    faceMatchLabel: "low",
    faceMatchColor: "#E74C3C",
    isSamePerson: false,
    faceMatchAttempted: true,
    faceMatchError: errorMsg,
  });

  // Step 1 — get the reference photo URL from the missing person case
  let referenceUrl: string | null = null;
  try {
    const caseDoc = await getDoc(doc(db, "missingPersons", caseId));
    if (!caseDoc.exists()) return failed("Missing person case not found.");
    const data = caseDoc.data();
    referenceUrl = data.photoUrl || null;
  } catch (e) {
    return failed("Could not fetch missing person photo.");
  }

  if (!referenceUrl) {
    return failed("No reference photo available for this case.");
  }

  if (!sightingUrl) {
    return failed("No sighting photo provided.");
  }

  // Step 2 — compare the two images
  try {
    const result: FaceMatchResult = await compareFacesByUrl(referenceUrl, sightingUrl);
    return {
      faceMatchScore: result.confidence,
      faceMatchLabel: result.label,
      faceMatchColor: result.color,
      isSamePerson: result.isSamePerson,
      faceMatchAttempted: true,
      faceMatchError: null,
    };
  } catch (e) {
    const err = e as FaceMatchError;
    return failed(err.message || "Face comparison failed.");
  }
}