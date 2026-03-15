import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC9t3moE4fuPyag8RJdXzMMzk87Xg1tip4",
  authDomain: "lost-person-alert.firebaseapp.com",
  projectId: "lost-person-alert",
  storageBucket: "lost-person-alert.firebasestorage.app",
  messagingSenderId: "389857812215",
  appId: "1:389857812215:web:d727a48a200220b1afbdf2",
  measurementId: "G-4BZ6JK17LV",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;