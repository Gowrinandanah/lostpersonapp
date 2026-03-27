// src/features/faceRecognition/faceMatcher.ts
//
// Core Face++ API wrapper.
// Compares two image URLs and returns a confidence score 0–100.

const FACE_API_KEY = "3IU2kl3GcwksgOmPCrwwGJOJPNklEdQG";       // ← replace with your key
const FACE_API_SECRET = "G8qDzbn6wyjIJY3ef3oZkaiiuP8UCqG3"; // ← replace with your secret
const FACE_API_URL = "https://api-us.faceplusplus.com/facepp/v3/compare";

export interface FaceMatchResult {
  confidence: number;       // 0–100
  isSamePerson: boolean;    // true if confidence >= 72.1 (Face++ recommended threshold)
  label: "high" | "medium" | "low";
  color: string;
}

export interface FaceMatchError {
  code: "NO_FACE" | "MULTIPLE_FACES" | "API_ERROR" | "NETWORK_ERROR";
  message: string;
}

// ── Compare two image URLs ────────────────────────────────────────────────────
export async function compareFacesByUrl(
  imageUrl1: string,
  imageUrl2: string
): Promise<FaceMatchResult> {
  const formData = new FormData();
  formData.append("api_key", FACE_API_KEY);
  formData.append("api_secret", FACE_API_SECRET);
  formData.append("image_url1", imageUrl1);
  formData.append("image_url2", imageUrl2);

  let response: Response;
  try {
    response = await fetch(FACE_API_URL, { method: "POST", body: formData });
  } catch (e) {
    throw {
      code: "NETWORK_ERROR",
      message: "Could not reach Face++ API. Check your internet connection.",
    } as FaceMatchError;
  }

  const data = await response.json();

  // Face++ returns error_message on failure
  if (data.error_message) {
    if (data.error_message.includes("NO_FACE_FOUND")) {
      throw {
        code: "NO_FACE",
        message: "No face detected in one or both images. Please use a clear face photo.",
      } as FaceMatchError;
    }
    throw {
      code: "API_ERROR",
      message: data.error_message,
    } as FaceMatchError;
  }

  const confidence: number = data.confidence ?? 0;

  return {
    confidence,
    isSamePerson: confidence >= 72.1, // Face++ recommended 1e-3 threshold
    ...getMatchLabel(confidence),
  };
}

// ── Get label and color from score ────────────────────────────────────────────
export function getMatchLabel(score: number): { label: "high" | "medium" | "low"; color: string } {
  if (score >= 80) return { label: "high",   color: "#2ECC71" };
  if (score >= 60) return { label: "medium", color: "#F39C12" };
  return                  { label: "low",    color: "#E74C3C" };
}

export function getMatchText(label: "high" | "medium" | "low"): string {
  if (label === "high")   return "High match";
  if (label === "medium") return "Possible match";
  return "Low match";
}