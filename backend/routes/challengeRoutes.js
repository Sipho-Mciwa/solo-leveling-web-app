const express = require('express');
const router = express.Router();
const { getTodayChallenges, generateDailyChallenges, completeChallenge } = require('../services/challengeService');
const { auth } = require('../config/firebase');

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

// GET /api/challenges/today
router.get('/today', authenticate, async (req, res) => {
  try {
    const result = await getTodayChallenges(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/challenges/generate
router.post('/generate', authenticate, async (req, res) => {
  try {
    const result = await generateDailyChallenges(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/challenges/:id/complete
router.patch('/:id/complete', authenticate, async (req, res) => {
  const { challengeKey } = req.body;
  if (!challengeKey || typeof challengeKey !== 'string') {
    return res.status(400).json({ error: 'challengeKey is required' });
  }
  try {
    const result = await completeChallenge(req.params.id, req.userId, challengeKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
