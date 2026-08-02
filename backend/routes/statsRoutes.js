const express = require('express');
const router = express.Router();
const { getUserStats } = require('../services/statsService');
const { getHunterRecords } = require('../services/hunterRecordsService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');

// GET /api/stats
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const stats = await getUserStats(req.userId);
  res.json(stats);
}));

// GET /api/stats/records
router.get('/records', authenticate, asyncHandler(async (req, res) => {
  const records = await getHunterRecords(req.userId);
  res.json(records);
}));

module.exports = router;
