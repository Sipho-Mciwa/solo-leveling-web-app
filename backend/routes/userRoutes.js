const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../utils/AppError');

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

// Hunter character-sheet fields — all optional so a partial update (e.g.
// just correcting height) doesn't require resending every field. Age is
// derived client-side from dateOfBirth, not stored directly.
const hunterDetailsSchema = z.object({
  firstName:   z.string().trim().min(1).max(40).optional(),
  lastName:    z.string().trim().max(40).optional(),
  height:      z.string().trim().max(20).optional(),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD').optional(),
  weight:      z.string().trim().max(20).optional(),
  sex:         z.string().trim().max(20).optional(),
  jobClass:    z.string().trim().max(30).optional(),
  hunterId:    z.string().trim().max(20).optional(),
});

// PATCH /api/users/me/details — set/update hunter character-sheet fields.
// Not wired to any in-app edit UI yet; used to persist real values once
// they're known, so the frontend's placeholder fallback (lib/hunterDetails.ts)
// stops applying for whichever fields are set here.
router.patch('/me/details', authenticate, validateBody(hunterDetailsSchema), asyncHandler(async (req, res) => {
  const userRef = db.collection('users').doc(req.userId);
  const snap = await userRef.get();
  if (!snap.exists) throw new AppError('User not found', 404);

  await userRef.update(req.body);
  res.json({ id: req.userId, ...snap.data(), ...req.body });
}));

module.exports = router;
