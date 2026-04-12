const admin = require('firebase-admin');

let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = admin.credential.cert(serviceAccount);
} else {
  // Local development fallback
  const serviceAccount = require('./serviceAccountKey.json');
  credential = admin.credential.cert(serviceAccount);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth };
