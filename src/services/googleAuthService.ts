// Google Sign-In using expo-auth-session + expo-web-browser
//
// Install (if not already):
//   npx expo install expo-auth-session expo-web-browser expo-crypto expo-constants

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { makeRedirectUri } from "expo-auth-session";
import { Platform } from "react-native";

// Required — registers the redirect handler for the auth session
WebBrowser.maybeCompleteAuthSession();

// ── Your Google Client IDs ────────────────────────────────────────────────────
// Get these from Google Cloud Console → APIs & Services → Credentials
export const GOOGLE_CLIENT_IDS = {
  // Web client ID from Firebase Console / Google Cloud Console
  webClientId:
    "389857812215-uo3qnlhiv4k9hss32khp9igrah4i9cr2.apps.googleusercontent.com",
  // Android client ID (SHA-1 fingerprint must be registered in Google Cloud Console)
  androidClientId:
    "389857812215-vdig4mm0b4luri0biam5f5bi5pb0o7ls.apps.googleusercontent.com",
  // iOS client ID — add later if needed
  iosClientId: "",
};

// ── Get redirect URI based on platform ───────────────────────────────────────
//
// For native Android dev/production builds, Google only accepts the
// reverse client ID format as the redirect scheme. This is automatically
// registered by Google — no manual setup needed in Cloud Console.
//
// Format: com.googleusercontent.apps.<ANDROID_CLIENT_ID_WITHOUT_SUFFIX>
// e.g.  : com.googleusercontent.apps.389857812215-vdig4mm0b4luri0biam5f5bi5pb0o7ls
//
export const getRedirectUri = () => {
  if (Platform.OS === "web") {
    // Web: uses window.location.origin automatically
    return makeRedirectUri();
  }

  // Native (Android/iOS) dev or production build:
  // Use the reverse client ID — extracted from your androidClientId
  return makeRedirectUri({
    scheme:
      "com.googleusercontent.apps.389857812215-vdig4mm0b4luri0biam5f5bi5pb0o7ls",
  });
};

// ── Hook for Google Sign-In ───────────────────────────────────────────────────
export const useGoogleSignIn = () => {
  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
    iosClientId: GOOGLE_CLIENT_IDS.iosClientId || undefined,
    webClientId: GOOGLE_CLIENT_IDS.webClientId,
    redirectUri,
    scopes: ["profile", "email"],
  });

  return { request, response, promptAsync };
};

// ── Save/update user in Firestore after sign in ───────────────────────────────
export async function saveUserToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      phone: user.phoneNumber || "",
      provider: "google",
      role: "user",
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      {
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

// ── Exchange Google ID token for Firebase credential ──────────────────────────
export async function signInWithGoogleToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
  await saveUserToFirestore();
}

// ── Handle Google Sign-In response ────────────────────────────────────────────
export async function handleGoogleSignInResponse(
  response: any,
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  if (response?.type === "success") {
    const { id_token } = response.params;

    if (!id_token) {
      onError?.(
        "No ID token returned from Google. Check your client IDs and redirect URI."
      );
      return;
    }

    try {
      await signInWithGoogleToken(id_token);
      onSuccess?.();
    } catch (error: any) {
      console.error("Firebase Google Sign-In Error:", error);
      onError?.(error.message || "Failed to sign in with Google");
    }
  } else if (response?.type === "error") {
    console.error("Google OAuth error:", response.error);
    onError?.(response.error?.message || "Google Sign-In failed");
  } else if (response?.type === "dismiss") {
    onError?.("Google Sign-In was cancelled");
  }
}