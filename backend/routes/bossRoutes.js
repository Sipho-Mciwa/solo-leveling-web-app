const express = require('express');
const router  = express.Router();
const {
  generateWeekendBoss,
  getWeekendBoss,
  completeWeekendBoss,
  claimWeekendReward,
} = require('../services/weekendBossService');
const { auth } = require('../config/firebase');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = await auth.verifyIdToken(header.split('Bearer ')[1]);
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Weekend boss ──────────────────────────────────────────────────────────────

// POST /api/boss/weekend/generate
router.post('/weekend/generate', authenticate, async (req, res) => {
  try {
    res.json(await generateWeekendBoss(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/boss/weekend/current
router.get('/weekend/current', authenticate, async (req, res) => {
  try {
    res.json(await getWeekendBoss(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boss/weekend/:id/complete
router.post('/weekend/:id/complete', authenticate, async (req, res) => {
  const { value, notes } = req.body;
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value is required' });
  }
  try {
    res.json(await completeWeekendBoss(req.params.id, req.userId, { value, notes }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boss/weekend/:id/claim
router.post('/weekend/:id/claim', authenticate, async (req, res) => {
  try {
    res.json(await claimWeekendReward(req.params.id, req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
