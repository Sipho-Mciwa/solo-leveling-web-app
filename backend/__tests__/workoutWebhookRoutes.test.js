jest.mock('../config/firebase', () => ({
  db: { collection: jest.fn() },
  auth: {},
}));

const request = require('supertest');
const express = require('express');
const { db } = require('../config/firebase');
const workoutWebhookRoutes = require('../routes/workoutWebhookRoutes');

const SECRET = 'test-secret';
const USER_ID = 'test-user-id';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/workouts/webhook', workoutWebhookRoutes);
  return app;
}

function validPayload(overrides = {}) {
  return {
    workoutType: 'Running',
    distance: 5,
    distanceUnit: 'km',
    duration: 30,
    durationUnit: 'min',
    activeEnergyCalories: 320,
    startDate: '2026-07-19T06:00:00.000Z',
    ...overrides,
  };
}

describe('POST /api/workouts/webhook', () => {
  let app;
  let addMock;

  beforeEach(() => {
    process.env.WORKOUT_WEBHOOK_SECRET = SECRET;
    process.env.WORKOUT_WEBHOOK_USER_ID = USER_ID;
    addMock = jest.fn().mockResolvedValue({ id: 'workout-123' });
    db.collection.mockReturnValue({ add: addMock });
    app = buildApp();
  });

  test('rejects requests with no Authorization header', async () => {
    const res = await request(app).post('/api/workouts/webhook').send(validPayload());
    expect(res.status).toBe(401);
  });

  test('rejects requests with the wrong secret', async () => {
    const res = await request(app)
      .post('/api/workouts/webhook')
      .set('Authorization', 'Bearer wrong-secret')
      .send(validPayload());
    expect(res.status).toBe(401);
  });

  test('rejects an invalid payload (missing required field)', async () => {
    const { startDate, ...incomplete } = validPayload();
    const res = await request(app)
      .post('/api/workouts/webhook')
      .set('Authorization', `Bearer ${SECRET}`)
      .send(incomplete);
    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  test('accepts a valid payload, normalizes to km/seconds, and stores it', async () => {
    const res = await request(app)
      .post('/api/workouts/webhook')
      .set('Authorization', `Bearer ${SECRET}`)
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(db.collection).toHaveBeenCalledWith('workouts');
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        source: 'ios-shortcuts',
        workoutType: 'Running',
        distanceKm: 5,
        durationSeconds: 1800,
        activeEnergyCalories: 320,
      })
    );
  });

  test('converts miles to km and seconds pass through unchanged', async () => {
    await request(app)
      .post('/api/workouts/webhook')
      .set('Authorization', `Bearer ${SECRET}`)
      .send(validPayload({ distance: 1, distanceUnit: 'mi', duration: 90, durationUnit: 'sec' }));

    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({ distanceKm: 1.609, durationSeconds: 90 })
    );
  });
});
