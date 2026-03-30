import type { User } from "firebase/auth";

function initials(email?: string | null) {
  if (!email) return "U";
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[._-]/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function isGoogleUser(user?: User | null) {
  if (!user) return false;
  return user.providerData.some((p) => p?.providerId === "google.com");
}

export function getUserHeaderName(user?: User | null) {
  if (user?.displayName) return user.displayName;
  return user?.email ?? "";
}

export function UserAvatar({ user }: { user?: User | null }) {
  if (isGoogleUser(user) && user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName ?? "User"}
        className="h-10 w-10 rounded-2xl border border-white/14 object-cover
                   shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="h-10 w-10 rounded-2xl border border-white/14
                 bg-gradient-to-b from-white/[0.14] to-white/[0.06]
                 backdrop-blur-2xl
                 flex items-center justify-center text-sm font-semibold text-white/92
                 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
      title={user?.email ?? "User"}
    >
      {initials(user?.email)}
    </div>
  );
}
