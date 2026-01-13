// ==========================
// Version 1 — src/firebase/pushTokens.ts
// - Stores push tokens per user:
//   users/{uid}/pushTokens/{token}
// ==========================
import { doc, serverTimestamp, setDoc, deleteDoc, type Firestore } from "firebase/firestore";

export function pushTokenDoc(db: Firestore, uid: string, token: string) {
  return doc(db, "users", uid, "pushTokens", token);
}

export async function savePushToken(db: Firestore, uid: string, token: string) {
  const ref = pushTokenDoc(db, uid, token);
  await setDoc(
    ref,
    {
      token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: "web",
    },
    { merge: true }
  );
}

export async function removePushToken(db: Firestore, uid: string, token: string) {
  const ref = pushTokenDoc(db, uid, token);
  await deleteDoc(ref);
}

// ==========================
// End of Version 1 — src/firebase/pushTokens.ts
// ==========================
