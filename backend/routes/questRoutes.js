const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { getTodayQuests, generateDailyQuests, updateQuestProgress, getQuestHistory } = require('../services/questService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');

const updateProgressSchema = z.object({
  currentValue: z.number().finite().min(0),
});

// GET /api/quests/history?month=YYYY-MM
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }
  const result = await getQuestHistory(req.userId, month);
  res.json(result);
}));

// GET /api/quests/today
router.get('/today', authenticate, asyncHandler(async (req, res) => {
  const quests = await getTodayQuests(req.userId);
  res.json(quests);
}));

// POST /api/quests/generate
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
  const result = await generateDailyQuests(req.userId);
  res.json(result);
}));

// PATCH /api/quests/:id
router.patch('/:id', authenticate, validateBody(updateProgressSchema), asyncHandler(async (req, res) => {
  const result = await updateQuestProgress(req.params.id, req.userId, req.body.currentValue);
  res.json(result);
}));

module.exports = router;
