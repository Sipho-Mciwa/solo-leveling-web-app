const express = require('express');
const router = express.Router();
const { getOverview, getQuestBreakdown, getHeatmap } = require('../services/analyticsService');
const { getRunningAnalytics } = require('../services/runningAnalyticsService');
const { auth } = require('../config/firebase');

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

// GET /api/analytics/overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    res.json(await getOverview(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/quests
router.get('/quests', authenticate, async (req, res) => {
  try {
    res.json(await getQuestBreakdown(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/heatmap
router.get('/heatmap', authenticate, async (req, res) => {
  try {
    res.json(await getHeatmap(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/running
router.get('/running', authenticate, async (req, res) => {
  try {
    res.json(await getRunningAnalytics(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
