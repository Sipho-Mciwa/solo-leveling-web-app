const express = require('express');
const router = express.Router();
const { getUserStats } = require('../services/statsService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/stats
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const stats = await getUserStats(req.userId);
  res.json(stats);
}));

module.exports = router;
