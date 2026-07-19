const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/users/me — fetch or create user profile
router.get('/me', authenticate, asyncHandler(async (req, res) => {
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
}));

module.exports = router;
