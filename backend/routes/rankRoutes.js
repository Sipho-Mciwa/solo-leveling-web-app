const express = require('express');
const router  = express.Router();
const { getUserRank, getRankProgress, setActiveTitle } = require('../services/rankService');
const { getTitleProgress } = require('../services/titleService');
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

// GET /api/rank  — recalculate and return rank + titles
router.get('/', authenticate, async (req, res) => {
  try {
    res.json(await getUserRank(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rank/progress  — next-rank criteria with current values
router.get('/progress', authenticate, async (req, res) => {
  try {
    res.json(await getRankProgress(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rank/titles/progress  — all titles with unlock state and progress bars
router.get('/titles/progress', authenticate, async (req, res) => {
  try {
    res.json(await getTitleProgress(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rank/title  — set active title
router.post('/title', authenticate, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    res.json(await setActiveTitle(req.userId, title));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
