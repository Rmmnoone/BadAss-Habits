// ==========================
// Version 5 — src/auth/AuthProvider.tsx
// - v4 + Admin custom claim support:
//   * Exposes isAdmin boolean from ID token claims (admin === true)
//   * Refreshes claims on auth state changes
// - Keeps Google sign-in behavior + ensureUserDoc best-effort
// - Keeps push token cleanup on logout
// ==========================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getIdTokenResult,
} from "firebase/auth";
import { auth, db } from "../firebase/client";
import { disablePushForUser } from "../utils/push";
import { ensureUserDoc } from "../firebase/users";

type AuthContextValue = {
  user: User | null;
  loading: boolean;

  isAdmin: boolean;
  refreshClaims: () => Promise<void>;

  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;

  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isPopupBlockedError(e: any): boolean {
  const code = String(e?.code ?? "");
  const msg = String(e?.message ?? "");
  return (
    code === "auth/popup-blocked" ||
    code === "auth/popup-closed-by-user" ||
    msg.toLowerCase().includes("popup")
  );
}

async function computeIsAdmin(u: User | null): Promise<boolean> {
  if (!u) return false;
  try {
    // force refresh = false (fast). We offer refreshClaims() for explicit refresh.
    const res = await getIdTokenResult(u, false);
    return res?.claims?.admin === true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshClaims = async () => {
    const u = auth.currentUser;
    if (!u) {
      setIsAdmin(false);
      return;
    }
    try {
      // Force refresh so newly-set claims apply immediately
      const res = await getIdTokenResult(u, true);
      setIsAdmin(res?.claims?.admin === true);
    } catch {
      setIsAdmin(false);
    }
  };

  // Handle redirect results (if popup fails and we fall back)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await getRedirectResult(auth);
        if (cancelled) return;

        const u = res?.user;
        if (u) {
          // Best-effort user doc
          try {
            await ensureUserDoc(db, u.uid, u.email);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log("[AuthProvider] ensureUserDoc(google redirect) failed (ignored):", e);
          }

          // Best-effort claim read
          try {
            const adminFlag = await computeIsAdmin(u);
            if (!cancelled) setIsAdmin(adminFlag);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("[AuthProvider] getRedirectResult failed (ignored):", e);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // compute admin claim
      const adminFlag = await computeIsAdmin(u);
      setIsAdmin(adminFlag);

      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      refreshClaims,

      register: async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        try {
          await ensureUserDoc(db, cred.user.uid, cred.user.email);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log("[AuthProvider] ensureUserDoc(register) failed (ignored):", e);
        }

        // claims likely not set yet, but keep behavior consistent
        try {
          const adminFlag = await computeIsAdmin(cred.user);
          setIsAdmin(adminFlag);
        } catch {
          // ignore
        }
      },

      login: async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email, password);

        try {
          await ensureUserDoc(db, cred.user.uid, cred.user.email);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log("[AuthProvider] ensureUserDoc(login) failed (ignored):", e);
        }

        try {
          const adminFlag = await computeIsAdmin(cred.user);
          setIsAdmin(adminFlag);
        } catch {
          // ignore
        }
      },

      loginWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        // provider.setCustomParameters({ prompt: "select_account" });

        try {
          const cred = await signInWithPopup(auth, provider);

          try {
            await ensureUserDoc(db, cred.user.uid, cred.user.email);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log("[AuthProvider] ensureUserDoc(google popup) failed (ignored):", e);
          }

          try {
            const adminFlag = await computeIsAdmin(cred.user);
            setIsAdmin(adminFlag);
          } catch {
            // ignore
          }
        } catch (e: any) {
          if (isPopupBlockedError(e)) {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw e;
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
        setIsAdmin(false);
      },
    }),
    [user, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}

// ==========================
// End of Version 5 — src/auth/AuthProvider.tsx
// ==========================
