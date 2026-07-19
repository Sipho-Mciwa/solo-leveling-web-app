const express = require('express');
const { z } = require('zod');
const router  = express.Router();
const { generatePenalty, getActivePenalty, updatePenaltyProgress } = require('../services/penaltyService');
const { authenticate } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');

const updateProgressSchema = z.object({
  currentValue: z.number().finite().min(0),
});

// POST /api/penalty/generate  — called on login
router.post('/generate', authenticate, asyncHandler(async (req, res) => {
  res.json(await generatePenalty(req.userId));
}));

// GET /api/penalty/active  — returns today's penalty quest or null
router.get('/active', authenticate, asyncHandler(async (req, res) => {
  res.json(await getActivePenalty(req.userId));
}));

// PATCH /api/penalty/:id  — log progress
router.patch('/:id', authenticate, validateBody(updateProgressSchema), asyncHandler(async (req, res) => {
  res.json(await updatePenaltyProgress(req.params.id, req.userId, req.body.currentValue));
}));

module.exports = router;
