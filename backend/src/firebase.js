const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
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
  if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) throw new Error("Firebase is not configured");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return { auth: getAuth, firestore: getFirestore };
}

function getDb() {
  return getAdmin().firestore();
}

function getBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
  return getStorage().bucket(bucketName);
}

module.exports = { getAdmin, getDb, getBucket, isConfigured };
