// ==========================
// Version 1 — src/firebase/users.ts
// - Ensures users/{uid} exists with timezone + createdAt
// - Called from login/register and/or enablePush
// ==========================
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  } catch {
    return "Europe/London";
  }
}

export async function ensureUserDoc(db: Firestore, uid: string, email?: string | null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(
    ref,
    {
      uid,
      email: email ?? null,
      timezone: getTimezone(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
// ==========================
// End of Version 1 — src/firebase/users.ts
// ==========================
