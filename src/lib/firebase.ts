import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Web config for the "hangout" Firebase project. These values are public by design;
// access is enforced by Firestore security rules (see firestore.rules).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyCWqsgTU6UW_ndXQeQlbubAqDBzuIGbeR4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "hangout-c0d41.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "hangout-c0d41",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "hangout-c0d41.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "367058996526",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:367058996526:web:02eae45ccf5076dc62febf",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
