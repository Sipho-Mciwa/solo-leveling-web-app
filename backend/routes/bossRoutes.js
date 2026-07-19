const express = require('express');
const { z } = require('zod');
const router  = express.Router();
const {
  generateWeekendBoss,
  getWeekendBoss,
  completeWeekendBoss,
  claimWeekendReward,
} = require('../services/weekendBossService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');

const completeSchema = z.object({
  value: z.union([z.number(), z.string()]),
  notes: z.string().max(500).optional(),
});

// ── Weekend boss ──────────────────────────────────────────────────────────────

// POST /api/boss/weekend/generate
router.post('/weekend/generate', authenticate, asyncHandler(async (req, res) => {
  res.json(await generateWeekendBoss(req.userId));
}));

// GET /api/boss/weekend/current
router.get('/weekend/current', authenticate, asyncHandler(async (req, res) => {
  res.json(await getWeekendBoss(req.userId));
}));

// POST /api/boss/weekend/:id/complete
router.post('/weekend/:id/complete', authenticate, validateBody(completeSchema), asyncHandler(async (req, res) => {
  const { value, notes } = req.body;
  res.json(await completeWeekendBoss(req.params.id, req.userId, { value, notes }));
}));

// POST /api/boss/weekend/:id/claim
router.post('/weekend/:id/claim', authenticate, asyncHandler(async (req, res) => {
  res.json(await claimWeekendReward(req.params.id, req.userId));
}));

module.exports = router;
