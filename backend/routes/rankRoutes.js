const express = require('express');
const { z } = require('zod');
const router  = express.Router();
const { getUserRank, getRankProgress, setActiveTitle } = require('../services/rankService');
const { getTitleProgress, evaluateTitles } = require('../services/titleService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { logger } = require('../utils/logger');

const setTitleSchema = z.object({
  title: z.string().min(1),
});

// GET /api/rank  — recalculate rank + fire-and-forget title evaluation
router.get('/', authenticate, asyncHandler(async (req, res) => {
  evaluateTitles(req.userId).catch((e) => logger.error({ err: e, userId: req.userId }, 'Title evaluation failed'));
  res.json(await getUserRank(req.userId));
}));

// GET /api/rank/progress  — next-rank criteria with current values
router.get('/progress', authenticate, asyncHandler(async (req, res) => {
  res.json(await getRankProgress(req.userId));
}));

// GET /api/rank/titles/progress  — evaluate earned titles then return full progress
router.get('/titles/progress', authenticate, asyncHandler(async (req, res) => {
  // Always evaluate first so newly-met conditions are awarded before the page renders
  await evaluateTitles(req.userId);
  res.json(await getTitleProgress(req.userId));
}));

// POST /api/rank/title  — set active title
router.post('/title', authenticate, validateBody(setTitleSchema), asyncHandler(async (req, res) => {
  res.json(await setActiveTitle(req.userId, req.body.title));
}));

module.exports = router;
