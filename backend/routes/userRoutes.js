const express = require('express');
const router = express.Router();
const { db, auth } = require('../config/firebase');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/users/me — fetch or create user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const userRef = db.collection('users').doc(req.userId);
    const snap = await userRef.get();

    if (snap.exists) {
      return res.json({ id: snap.id, ...snap.data() });
    }

    // First login — create profile
    const newUser = {
      email:          req.query.email || '',
      xp:             0,
      level:          1,
      streakCount:    0,
      lastActiveDate: null,
      rank:           'E',
      titles:         ['E Rank Hunter'],
      activeTitle:    'E Rank Hunter',
    };
    await userRef.set(newUser);
    res.json({ id: req.userId, ...newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
