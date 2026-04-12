const express = require('express');
const router = express.Router();
const { getTodayQuests, generateDailyQuests, updateQuestProgress } = require('../services/questService');
const { auth } = require('../config/firebase');

// Middleware: verify Firebase ID token
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

// GET /api/quests/today
router.get('/today', authenticate, async (req, res) => {
  try {
    const quests = await getTodayQuests(req.userId);
    res.json(quests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quests/generate
router.post('/generate', authenticate, async (req, res) => {
  try {
    const result = await generateDailyQuests(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/quests/:id
router.patch('/:id', authenticate, async (req, res) => {
  const { currentValue } = req.body;
  if (typeof currentValue !== 'number') {
    return res.status(400).json({ error: 'currentValue must be a number' });
  }
  try {
    const result = await updateQuestProgress(req.params.id, req.userId, currentValue);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
