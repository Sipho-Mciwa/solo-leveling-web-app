const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  jest.resetModules();
  // Force the no-API-key fallback path so results are deterministic —
  // we're not testing the LLM integration here, just the status tagging.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

describe('generateChallenges', () => {
  test('tags each generated suggestion with status "suggested"', async () => {
    const { generateChallenges } = require('../services/ai.service');
    const userId = 'user-1';

    await mockFakeDb.collection('users').doc(userId).set({ rank: 'E', level: 1, streakCount: 0 });

    const challenges = await generateChallenges(userId);

    expect(challenges.length).toBeGreaterThan(0);
    for (const c of challenges) {
      expect(c.status).toBe('suggested');
    }
  });

  test('caches the tagged suggestions so a second call returns the same status', async () => {
    const { generateChallenges } = require('../services/ai.service');
    const userId = 'user-2';

    await mockFakeDb.collection('users').doc(userId).set({ rank: 'E', level: 1, streakCount: 0 });

    const first = await generateChallenges(userId);
    const second = await generateChallenges(userId);

    expect(second).toEqual(first);
    expect(second[0].status).toBe('suggested');
  });
});
