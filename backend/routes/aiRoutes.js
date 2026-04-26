const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
const { generateInsight, generateChallenges } = require('../services/ai.service');
const { getMemory, updateMemory, generateWeeklySummary } = require('../services/aiMemory.service');
const { generateSystemEvents, markEventsSeen, triggerNarrativeEvent } = require('../services/aiEvents.service');

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

// POST /api/ai/insight
router.post('/insight', authenticate, async (req, res) => {
  try {
    const insight = await generateInsight(req.userId);
    res.json({ insight });
  } catch (err) {
    console.error('[AI Route] insight error:', err.message);
    res.json({ insight: 'Stay consistent today. Complete all challenges.' });
  }
});

// POST /api/ai/challenges
router.post('/challenges', authenticate, async (req, res) => {
  try {
    const challenges = await generateChallenges(req.userId);
    res.json({ challenges });
  } catch (err) {
    console.error('[AI Route] challenges error:', err.message);
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
router.get('/memory', authenticate, async (req, res) => {
  try {
    const memory = await getMemory(req.userId);
    res.json({ memory: memory || null });
  } catch (err) {
    console.error('[AI Route] memory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/update-memory
router.post('/update-memory', authenticate, async (req, res) => {
  try {
    const memory = await updateMemory(req.userId);
    res.json({ updated: true, memory });
  } catch (err) {
    console.error('[AI Route] update-memory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/weekly-summary
router.get('/weekly-summary', authenticate, async (req, res) => {
  try {
    const text = await generateWeeklySummary(req.userId);
    res.json({ summary: text });
  } catch (err) {
    console.error('[AI Route] weekly-summary error:', err.message);
    res.json({ summary: 'Another week logged. Keep pushing — review your patterns and sharpen your weaknesses.' });
  }
});

// GET /api/ai/events — generate/retrieve today's system feed
router.get('/events', authenticate, async (req, res) => {
  try {
    const events = await generateSystemEvents(req.userId);
    const unseenCount = events.filter((e) => !e.seen).length;
    res.json({ events, unseenCount });
  } catch (err) {
    console.error('[AI Route] events error:', err.message);
    res.json({ events: [], unseenCount: 0 });
  }
});

// PATCH /api/ai/events/seen — mark all current events as seen
router.patch('/events/seen', authenticate, async (req, res) => {
  try {
    await markEventsSeen(req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AI Route] mark-seen error:', err.message);
    res.json({ ok: false });
  }
});

// POST /api/ai/narrative — trigger a narrative event (level-up, rank-up, boss kill)
router.post('/narrative', authenticate, async (req, res) => {
  try {
    const { eventType, payload } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType required' });
    const event = await triggerNarrativeEvent(req.userId, eventType, payload || {});
    res.json({ event });
  } catch (err) {
    console.error('[AI Route] narrative error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
