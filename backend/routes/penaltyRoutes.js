const express = require('express');
const router  = express.Router();
const { generatePenalty, getActivePenalty, updatePenaltyProgress } = require('../services/penaltyService');
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

// POST /api/penalty/generate  — called on login
router.post('/generate', authenticate, async (req, res) => {
  try {
    res.json(await generatePenalty(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/penalty/active  — returns today's penalty quest or null
router.get('/active', authenticate, async (req, res) => {
  try {
    res.json(await getActivePenalty(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/penalty/:id  — log progress
router.patch('/:id', authenticate, async (req, res) => {
  const { currentValue } = req.body;
  if (typeof currentValue !== 'number') {
    return res.status(400).json({ error: 'currentValue must be a number' });
  }
  try {
    res.json(await updatePenaltyProgress(req.params.id, req.userId, currentValue));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
