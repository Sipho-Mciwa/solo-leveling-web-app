const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = cert(serviceAccount);
} else {
  // Local development fallback
  const serviceAccount = require('./serviceAccountKey.json');
  credential = cert(serviceAccount);
}

if (!getApps().length) {
  initializeApp({ credential });
}

const db = getFirestore();
const auth = getAuth();

module.exports = { db, auth };
