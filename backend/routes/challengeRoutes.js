const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { getTodayChallenges, generateDailyChallenges, completeChallenge, getChallengeHistory } = require('../services/challengeService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');

const completeChallengeSchema = z.object({
  challengeKey: z.string().min(1),
});

// GET /api/challenges/history?month=YYYY-MM
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month query param required (YYYY-MM)' });
  }
  const result = await getChallengeHistory(req.userId, month);
  res.json(result);
}));

// GET /api/challenges/today
router.get('/today', authenticate, asyncHandler(async (req, res) => {
  const result = await getTodayChallenges(req.userId);
  res.json(result);
}));

// POST /api/challenges/generate
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
  const result = await generateDailyChallenges(req.userId);
  res.json(result);
}));

// PATCH /api/challenges/:id/complete
router.patch('/:id/complete', authenticate, validateBody(completeChallengeSchema), asyncHandler(async (req, res) => {
  const result = await completeChallenge(req.params.id, req.userId, req.body.challengeKey);
  res.json(result);
}));

module.exports = router;
