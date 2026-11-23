import { initializeApp, getApps } from "firebase/app";
import { 
  getAuth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink, 
  signOut,
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Firebase configuration from environment variables or sensible defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSySecretSantaDefaultDemoKey2026X",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "secret-santa-christmas-magic.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "secret-santa-christmas-magic",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "secret-santa-christmas-magic.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

// Check if live Firebase is configured with real keys
export const isLiveFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_API_KEY !== "AIzaSySecretSantaDefaultDemoKey2026X"
);

let app;
let auth;
let db;
let functions;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
} catch (err) {
  console.warn("Firebase initialization notice:", err.message);
}

export { 
  app, 
  auth, 
  db, 
  functions, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink, 
  signOut,
  onAuthStateChanged 
};
