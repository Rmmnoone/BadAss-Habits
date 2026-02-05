// ==========================
// Version 4 — src/firebase/users.ts
// - v3 + Phase 3.4 Timezone Override (user-level):
//   * Adds helper setUserTimezone()
// - Keeps Phase 3.1 remindersEnabled + Phase 3.3 quietHours
// ==========================
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
  updateDoc,
} from "firebase/firestore";

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  } catch {
    return "Europe/London";
  }
}

type QuietHours = {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
};

function defaultQuietHours(): QuietHours {
  return { enabled: false, start: "22:00", end: "07:00" };
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
      remindersEnabled: true, // Phase 3.1 default
      quietHours: defaultQuietHours(), // Phase 3.3 default (disabled)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setUserRemindersEnabled(db: Firestore, uid: string, enabled: boolean) {
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid,
        remindersEnabled: enabled,
        timezone: getTimezone(),
        quietHours: defaultQuietHours(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await updateDoc(ref, {
    remindersEnabled: enabled,
    updatedAt: serverTimestamp(),
  });
}

export async function setUserQuietHours(db: Firestore, uid: string, quiet: QuietHours) {
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid,
        timezone: getTimezone(),
        remindersEnabled: true,
        quietHours: quiet,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await updateDoc(ref, {
    quietHours: quiet,
    updatedAt: serverTimestamp(),
  });
}

// Phase 3.4: timezone override (user-level)
export async function setUserTimezone(db: Firestore, uid: string, timezone: string) {
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid,
        timezone: timezone || getTimezone(),
        remindersEnabled: true,
        quietHours: defaultQuietHours(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await updateDoc(ref, {
    timezone: timezone || getTimezone(),
    updatedAt: serverTimestamp(),
  });
}

// ==========================
// End of Version 4 — src/firebase/users.ts
// ==========================
