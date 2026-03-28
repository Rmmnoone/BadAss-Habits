// ==========================
// Version 4 — src/firebase/client.ts
// - v3 + Functions export for callable test push
// ==========================
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY as string | undefined;

// ✅ IMPORTANT: export app so Messaging can use the same instance
export const app = initializeApp(firebaseConfig);

export const appCheck =
  typeof window !== "undefined" && appCheckSiteKey
    ? initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    : null;

export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ Cloud Functions (callable)
export const functions = getFunctions(app, "europe-west2");

// ==========================
// End of Version 4 — src/firebase/client.ts
// ==========================
