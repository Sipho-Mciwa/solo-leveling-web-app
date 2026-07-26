const { auth } = require('../config/firebase');

// This is a single-user personal app — only this account may authenticate.
// This check (not the frontend's) is the actual security boundary, since a
// valid Firebase ID token for any other account would otherwise pass verification.
const ALLOWED_EMAIL = 'siphomciwa@gmail.com';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.email !== ALLOWED_EMAIL) {
      return res.status(403).json({ error: 'Access restricted to a single authorized account' });
    }
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
