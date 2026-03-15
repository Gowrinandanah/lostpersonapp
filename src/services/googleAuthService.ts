// Google Sign-In using expo-auth-session + expo-web-browser
// This works in Expo Go — no native build required.
//
// Install:
//   npx expo install expo-auth-session expo-web-browser expo-crypto

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  signInWithCredential,
  getAuth,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

// Required — registers the redirect handler for the auth session
WebBrowser.maybeCompleteAuthSession();

// ── Your Google Client IDs ────────────────────────────────────────────────────
// Get these from Google Cloud Console → APIs & Services → Credentials
// OR from Firebase Console → Authentication → Sign-in method → Google → Web client ID

export const GOOGLE_CLIENT_IDS = {
  // Web client ID from Firebase Console → Auth → Google → Web client ID
  webClientId:     "389857812215-uo3qnlhiv4k9hss32khp9igrah4i9cr2.apps.googleusercontent.com",
  // Android client ID from Google Cloud Console (optional for Expo Go)
  androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  // iOS client ID (optional)
  iosClientId:     "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
};

// ── Save/update user in Firestore after sign in ───────────────────────────────
export async function saveUserToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef  = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid:         user.uid,
      displayName: user.displayName || "",
      email:       user.email || "",
      photoURL:    user.photoURL || "",
      provider:    "google",
      role:        "user",
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });
  } else {
    await setDoc(userRef, {
      displayName: user.displayName || "",
      photoURL:    user.photoURL || "",
      updatedAt:   serverTimestamp(),
    }, { merge: true });
  }
}

// ── Exchange Google auth token for Firebase credential ────────────────────────
export async function signInWithGoogleToken(idToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
  await saveUserToFirestore();
}