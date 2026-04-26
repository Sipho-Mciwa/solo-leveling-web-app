const express = require('express');
const router = express.Router();
const { auth } = require('../config/firebase');
const { generateInsight, generateChallenges } = require('../services/ai.service');
const { getMemory, updateMemory, generateWeeklySummary } = require('../services/aiMemory.service');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/ai/insight
router.post('/insight', authenticate, async (req, res) => {
  try {
    const insight = await generateInsight(req.userId);
    res.json({ insight });
  } catch (err) {
    console.error('[AI Route] insight error:', err.message);
    res.json({ insight: 'Stay consistent today. Complete all challenges.' });
  }
});

// POST /api/ai/challenges
router.post('/challenges', authenticate, async (req, res) => {
  try {
    const challenges = await generateChallenges(req.userId);
    res.json({ challenges });
  } catch (err) {
    console.error('[AI Route] challenges error:', err.message);
    res.json({
      challenges: [
        {
          title: 'Complete every daily challenge',
          description: "Don't skip a single one today.",
          xpReward: 25,
        },
      ],
    });
  }
});

// GET /api/ai/memory
router.get('/memory', authenticate, async (req, res) => {
  try {
    const memory = await getMemory(req.userId);
    res.json({ memory: memory || null });
  } catch (err) {
    console.error('[AI Route] memory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/update-memory
router.post('/update-memory', authenticate, async (req, res) => {
  try {
    const memory = await updateMemory(req.userId);
    res.json({ updated: true, memory });
  } catch (err) {
    console.error('[AI Route] update-memory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/weekly-summary
router.get('/weekly-summary', authenticate, async (req, res) => {
  try {
    const text = await generateWeeklySummary(req.userId);
    res.json({ summary: text });
  } catch (err) {
    console.error('[AI Route] weekly-summary error:', err.message);
    res.json({ summary: 'Another week logged. Keep pushing — review your patterns and sharpen your weaknesses.' });
  }
});

module.exports = router;
