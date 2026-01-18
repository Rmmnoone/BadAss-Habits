// ==========================
// Version 3 — src/auth/AuthProvider.tsx
// - v2 + ensureUserDoc is best-effort (never blocks login/register UX)
// - Keeps push token cleanup on logout
// ==========================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "../firebase/client";
import { disablePushForUser } from "../utils/push";
import { ensureUserDoc } from "../firebase/users";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,

      register: async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Best-effort: don’t break signup if Firestore rules/config hiccup
        try {
          await ensureUserDoc(db, cred.user.uid, cred.user.email);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log("[AuthProvider] ensureUserDoc(register) failed (ignored):", e);
        }
      },

      login: async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email, password);

        // Best-effort: don’t break login if Firestore rules/config hiccup
        try {
          await ensureUserDoc(db, cred.user.uid, cred.user.email);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log("[AuthProvider] ensureUserDoc(login) failed (ignored):", e);
        }
      },

      logout: async () => {
        const uid = user?.uid ?? null;
        if (uid) {
          try {
            await disablePushForUser(uid);
          } catch {
            // ignore
          }
        }
        await signOut(auth);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}

// ==========================
// End of Version 3 — src/auth/AuthProvider.tsx
// ==========================
