const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { db } = require('../config/firebase');
const { webhookAuth } = require('../middleware/webhookAuth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');

const KM_PER_MILE = 1.60934;

const workoutSchema = z.object({
  workoutType: z.string().trim().min(1).max(64),
  distance: z.number().finite().positive(),
  distanceUnit: z.enum(['km', 'mi']).default('km'),
  duration: z.number().finite().positive(),
  durationUnit: z.enum(['min', 'sec']).default('min'),
  activeEnergyCalories: z.number().finite().min(0),
  startDate: z.string().datetime({ offset: true }),
});

// POST /api/workouts/webhook
//
// Receives a workout logged on iPhone/Apple Watch (HealthKit) and relayed by
// an iOS Shortcuts automation as an HTTP POST. Authenticated with a static
// shared secret (see middleware/webhookAuth.js) rather than a Firebase ID
// token, since Shortcuts can't complete an interactive sign-in.
router.post(
  '/',
  webhookAuth,
  validateBody(workoutSchema),
  asyncHandler(async (req, res) => {
    const { workoutType, distance, distanceUnit, duration, durationUnit, activeEnergyCalories, startDate } =
      req.body;

    const distanceKm = distanceUnit === 'mi' ? distance * KM_PER_MILE : distance;
    const durationSeconds = durationUnit === 'min' ? duration * 60 : duration;

    const workout = {
      userId: req.userId,
      source: 'ios-shortcuts',
      workoutType,
      distanceKm: Number(distanceKm.toFixed(3)),
      durationSeconds: Math.round(durationSeconds),
      activeEnergyCalories,
      startDate,
      receivedAt: new Date().toISOString(),
    };

    const docRef = await db.collection('workouts').add(workout);

    res.status(201).json({ id: docRef.id, workout });
  })
);

module.exports = router;
