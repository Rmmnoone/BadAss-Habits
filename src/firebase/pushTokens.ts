// ==========================
// Version 2 — src/firebase/pushTokens.ts
// - v1 + avoids resetting createdAt on updates
// - Adds: upsertPushToken() that preserves createdAt if doc exists
// - Still stores tokens at: users/{uid}/pushTokens/{token}
// ==========================
import {
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";

export function pushTokenDoc(db: Firestore, uid: string, token: string) {
  return doc(db, "users", uid, "pushTokens", token);
}

/**
 * Upsert token doc, but preserve createdAt if it already exists.
 * (So createdAt stays meaningful; updatedAt always changes.)
 */
export async function upsertPushToken(db: Firestore, uid: string, token: string) {
  const ref = pushTokenDoc(db, uid, token);
  const snap = await getDoc(ref);

  const base = {
    token,
    updatedAt: serverTimestamp(),
    platform: "web",
  };

  if (snap.exists()) {
    // Preserve createdAt
    await setDoc(ref, base, { merge: true });
    return { created: false as const };
  }

  await setDoc(
    ref,
    {
      ...base,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { created: true as const };
}

export async function removePushToken(db: Firestore, uid: string, token: string) {
  const ref = pushTokenDoc(db, uid, token);
  await deleteDoc(ref);
}

// ==========================
// End of Version 2 — src/firebase/pushTokens.ts
// ==========================
