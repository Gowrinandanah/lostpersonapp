// src/features/sightings/reportSightingController.ts
//
// Orchestrates the full sighting report flow:
// 1. Upload sighting photo to Cloudinary
// 2. Run face comparison against the missing person's reference photo
// 3. Save the sighting + face match result to Firestore

import { uploadImageToCloudinary } from "../../services/cloudinaryService";
import { saveSighting, SightingReport } from "./sightingService";
import { auth } from "../../firebase/firebaseConfig";
import { runFaceComparison, FaceComparisonPayload } from "../faceRecognition/faceService";

export interface SubmitSightingInput {
  caseId: string;
  sightingLocation: string;
  sightingDate: string;
  description: string;
  confidence: "low" | "medium" | "high";
  contactPhone: string;
  imageUri: string | null;   // local file URI from ImagePicker
  coordinates: { latitude: number; longitude: number } | null;
}

export interface SubmitSightingResult {
  sightingId: string;
  faceMatchScore: number;
  faceMatchLabel: "high" | "medium" | "low";
  faceMatchColor: string;
  isSamePerson: boolean;
  faceMatchAttempted: boolean;
  faceMatchError: string | null;
  photoUrl: string;
}

// ── Main controller function ──────────────────────────────────────────────────
export async function submitSightingReport(
  input: SubmitSightingInput
): Promise<SubmitSightingResult> {
  const user = auth.currentUser;

  // Step 1 — Upload sighting photo to Cloudinary (if provided)
  let photoUrl = "";
  if (input.imageUri) {
    const uploaded = await uploadImageToCloudinary(input.imageUri);
    photoUrl = uploaded.url;
  }

  // Step 2 — Run face comparison (only if a photo was uploaded)
  let facePayload: FaceComparisonPayload = {
  faceMatchScore: 0,
  faceMatchLabel: "low",
  faceMatchColor: "#E74C3C",
  isSamePerson: false,
  faceMatchAttempted: false,
  faceMatchError: "No sighting photo provided — face comparison skipped.",
};

  if (photoUrl) {
    facePayload = await runFaceComparison(input.caseId, photoUrl);
  }

  // Step 3 — Save full sighting report + face result to Firestore
  const sightingData: Omit<SightingReport, "id" | "createdAt"> = {
    caseId:           input.caseId,
    sightingLocation: input.sightingLocation,
    sightingDate:     input.sightingDate,
    description:      input.description,
    confidence:       input.confidence,
    contactPhone:     input.contactPhone,
    photoUrl,
    coordinates:      input.coordinates,
    sightingLat:      input.coordinates?.latitude  ?? null,
    sightingLng:      input.coordinates?.longitude ?? null,
    reportedBy:       user?.uid || "anonymous",
    reportedByName:   user?.displayName || "Anonymous",
    verified:         false,
    ...facePayload,
  };

  const sightingId = await saveSighting(sightingData);

  return {
    sightingId,
    photoUrl,
    ...facePayload,
  };
}