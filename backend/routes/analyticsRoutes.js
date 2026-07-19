const express = require('express');
const router = express.Router();
const { getOverview, getQuestBreakdown, getHeatmap } = require('../services/analyticsService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/analytics/overview
router.get('/overview', authenticate, asyncHandler(async (req, res) => {
  res.json(await getOverview(req.userId));
}));

// GET /api/analytics/quests
router.get('/quests', authenticate, asyncHandler(async (req, res) => {
  res.json(await getQuestBreakdown(req.userId));
}));

// GET /api/analytics/heatmap
router.get('/heatmap', authenticate, asyncHandler(async (req, res) => {
  res.json(await getHeatmap(req.userId));
}));

module.exports = router;
