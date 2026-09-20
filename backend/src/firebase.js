const admin = require("firebase-admin");
const fs = require("node:fs");

// Firebase is initialised lazily so the server can boot (and serve /api/health) without credentials.
// Provide ONE of:
//   FIREBASE_SERVICE_ACCOUNT_JSON  – the service-account JSON as a string (best for hosting env vars)
//   FIREBASE_SERVICE_ACCOUNT_PATH  – path to the downloaded key file (keep it OUT of git)
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
  return null;
}

function isConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

function getAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) throw new Error("Firebase is not configured");
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

module.exports = { getAdmin, isConfigured };
