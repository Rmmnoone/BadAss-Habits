// scripts/setAdminClaim.cjs
const admin = require("firebase-admin");

// Use a service account JSON (download from Firebase Console → Project settings → Service accounts)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: node scripts/setAdminClaim.cjs <UID>");
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log("✅ Set admin claim for:", uid);
  console.log("Now logout/login on the site (or refreshClaims) to pull the new token.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
