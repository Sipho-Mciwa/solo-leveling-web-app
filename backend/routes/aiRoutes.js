const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { generateInsight, generateChallenges } = require('../services/ai.service');
const { getMemory, updateMemory, generateWeeklySummary } = require('../services/aiMemory.service');
const { generateSystemEvents, markEventsSeen, triggerNarrativeEvent } = require('../services/aiEvents.service');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimit');
const { logger } = require('../utils/logger');

router.use(authenticate, aiLimiter);

const narrativeSchema = z.object({
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/ai/insight
router.post('/insight', async (req, res) => {
  try {
    const insight = await generateInsight(req.userId);
    res.json({ insight });
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[AI Route] insight error');
    res.json({ insight: 'Stay consistent today. Complete all challenges.' });
  }
});

// POST /api/ai/challenges
router.post('/challenges', async (req, res) => {
  try {
    const challenges = await generateChallenges(req.userId);
    res.json({ challenges });
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[AI Route] challenges error');
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
router.get('/memory', asyncHandler(async (req, res) => {
  const memory = await getMemory(req.userId);
  res.json({ memory: memory || null });
}));

// POST /api/ai/update-memory
router.post('/update-memory', asyncHandler(async (req, res) => {
  const memory = await updateMemory(req.userId);
  res.json({ updated: true, memory });
}));

// GET /api/ai/weekly-summary
router.get('/weekly-summary', async (req, res) => {
  try {
    const text = await generateWeeklySummary(req.userId);
    res.json({ summary: text });
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[AI Route] weekly-summary error');
    res.json({ summary: 'Another week logged. Keep pushing — review your patterns and sharpen your weaknesses.' });
  }
});

// GET /api/ai/events — generate/retrieve today's system feed
router.get('/events', async (req, res) => {
  try {
    const events = await generateSystemEvents(req.userId);
    const unseenCount = events.filter((e) => !e.seen).length;
    res.json({ events, unseenCount });
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[AI Route] events error');
    res.json({ events: [], unseenCount: 0 });
  }
});

// PATCH /api/ai/events/seen — mark all current events as seen
router.patch('/events/seen', async (req, res) => {
  try {
    await markEventsSeen(req.userId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId: req.userId }, '[AI Route] mark-seen error');
    res.json({ ok: false });
  }
});

// POST /api/ai/narrative — trigger a narrative event (level-up, rank-up, boss kill)
router.post('/narrative', validateBody(narrativeSchema), asyncHandler(async (req, res) => {
  const { eventType, payload } = req.body;
  const event = await triggerNarrativeEvent(req.userId, eventType, payload || {});
  res.json({ event });
}));

module.exports = router;
