const { db } = require('../config/firebase');
const { getMemory } = require('./aiMemory.service');
const { VOICE_INSTRUCTION, FALLBACKS, buildMemoryBlock } = require('./systemVoice');
const { computeXpGain } = require('./xpService');
const { evaluateTitles } = require('./titleService');
const { updateUserRank } = require('./rankService');
const { AppError } = require('../utils/AppError');
const { logger } = require('../utils/logger');

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_INSIGHT = FALLBACKS.insight;
const DEFAULT_CHALLENGES = [
  {
    title: 'Complete all daily protocols',
    description: FALLBACKS.challenge,
    xpReward: 25,
  },
];
const DEFAULT_SUBTASKS = [
  'Initiate the protocol immediately.',
  'Execute without interruption.',
  'Log completion status.',
];

// ─── Cache (one document per user, refreshed daily) ───────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function getCachedAI(userId) {
  try {
    const snap = await db.collection('aiCache').doc(userId).get();
    if (snap.exists) {
      const data = snap.data();
      if (data.date === todayStr()) return data;
    }
  } catch (e) {
    logger.error({ err: e }, '[AI] Cache read error');
  }
  return null;
}

async function setCachedAI(userId, insight, challenges) {
  try {
    await db.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight,
      challenges,
    });
  } catch (e) {
    logger.error({ err: e }, '[AI] Cache write error');
  }
}

// ─── User context ─────────────────────────────────────────────────────────────

async function getUserContext(userId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];

  const [userSnap, questSnap, memory] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('dailyQuests')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', todayStr())
      .get(),
    getMemory(userId).catch(() => null),
  ]);

  const user = userSnap.exists ? userSnap.data() : {};
  const quests = questSnap.docs.map((d) => d.data());
  const completed = quests.filter((q) => q.completed).length;
  const completionRate = quests.length > 0 ? Math.round((completed / quests.length) * 100) : 0;

  return {
    rank: user.rank || 'E',
    level: user.level || 1,
    streak: user.streakCount || 0,
    completionRate,
    completedQuests: completed,
    totalQuests: quests.length,
    missedQuests: quests.length - completed,
    memory,
  };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(prompt) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });
  return completion.choices[0].message.content.trim();
}

// ─── Fallback chain ───────────────────────────────────────────────────────────

async function callAI(prompt, fallback) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGemini(prompt);
    } catch (e) {
      logger.error({ err: e }, '[AI] Gemini failed');
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(prompt);
    } catch (e) {
      logger.error({ err: e }, '[AI] Groq failed');
    }
  }
  logger.warn('[AI] All providers failed — using default response');
  return fallback;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildInsightPrompt(ctx) {
  return `${VOICE_INSTRUCTION}

Hunter data:
- Rank: ${ctx.rank}, Level: ${ctx.level}
- Active streak: ${ctx.streak} days
- 7-day completion: ${ctx.completionRate}% (${ctx.completedQuests}/${ctx.totalQuests} quests)
- Missed this week: ${ctx.missedQuests} quests${buildMemoryBlock(ctx.memory)}

Generate one performance assessment. Maximum 2 sentences. Reference specific numbers. Identify the primary deviation from required output, or confirm acceptable status if output is sufficient.`;
}

function buildChallengesPrompt(ctx) {
  return `${VOICE_INSTRUCTION}

Hunter data:
- Rank: ${ctx.rank}, Level: ${ctx.level}
- Active streak: ${ctx.streak} days
- 7-day completion: ${ctx.completionRate}%${buildMemoryBlock(ctx.memory)}

Generate exactly 2 targeted daily protocols as a JSON array. Return ONLY the JSON array, no explanation, no markdown:
[{"title":"short title","description":"one directive sentence","xpReward":20}]

Constraints:
- Title: 3-6 words, no punctuation
- Description: one imperative sentence using approved vocabulary
- xpReward: integer between 15 and 35
- No running or distance protocols (tracked separately via the Running quest)
- If historical patterns are available, target the highest-miss protocol or lowest output day`;
}

function buildSubtasksPrompt(challenge) {
  return `${VOICE_INSTRUCTION}

Protocol: ${challenge.title}
Directive: ${challenge.description}

Break this protocol into 3 to 5 concrete, sequential action steps as a JSON array of strings. Return ONLY the JSON array, no explanation, no markdown:
["step one", "step two", "step three"]

Constraints:
- Each step: one short imperative sentence, approved vocabulary, no punctuation beyond a period
- Steps must be concrete actions the hunter physically does, not restatements of the goal`;
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

function parseChallengesJSON(text) {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) return null;
  return parsed.slice(0, 2).map((c) => ({
    title: String(c.title || '').trim(),
    description: String(c.description || '').trim(),
    xpReward: Math.max(15, Math.min(35, Number(c.xpReward) || 20)),
  }));
}

function parseSubtasksJSON(text) {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.slice(0, 5).map((title) => ({ title: String(title).trim(), completed: false }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function generateInsight(userId) {
  const cached = await getCachedAI(userId);
  if (cached?.insight) return cached.insight;

  const ctx = await getUserContext(userId);
  const prompt = buildInsightPrompt(ctx);
  const insight = await callAI(prompt, DEFAULT_INSIGHT);

  // Cache alongside challenges if they already exist, otherwise store partial
  const current = await getCachedAI(userId);
  await setCachedAI(userId, insight, current?.challenges || null);

  return insight;
}

async function generateChallenges(userId) {
  const cached = await getCachedAI(userId);
  if (cached?.challenges) return cached.challenges;

  const ctx = await getUserContext(userId);
  const prompt = buildChallengesPrompt(ctx);
  const raw = await callAI(prompt, JSON.stringify(DEFAULT_CHALLENGES));

  let challenges;
  try {
    challenges = parseChallengesJSON(raw);
    if (!challenges || challenges.length === 0) throw new Error('Empty parse');
  } catch {
    logger.error('[AI] Challenge parse failed, using default');
    challenges = DEFAULT_CHALLENGES;
  }

  challenges = challenges.map((c) => ({ ...c, status: 'suggested' }));

  const current = await getCachedAI(userId);
  await setCachedAI(userId, current?.insight || null, challenges);

  return challenges;
}

/**
 * Moves a cached suggestion from 'suggested' to 'accepted'.
 * Idempotent: accepting an already-accepted or completed suggestion just
 * returns its current status without modifying anything.
 */
async function acceptChallenge(userId, index) {
  const aiRef = db.collection('aiCache').doc(userId);

  return db.runTransaction(async (tx) => {
    const aiSnap = await tx.get(aiRef);
    if (!aiSnap.exists) throw new AppError('Suggestions not found', 404);

    const data = aiSnap.data();
    if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

    const challenge = data.challenges?.[index];
    if (!challenge) throw new AppError('Suggestion not found', 404);

    const status = challenge.status ?? 'suggested';
    if (status !== 'suggested') {
      return { status };
    }

    const alreadySelected = data.challenges.some(
      (c, i) => i !== index && (c.status ?? 'suggested') !== 'suggested'
    );
    if (alreadySelected) {
      throw new AppError('Another suggestion has already been selected today', 409);
    }

    const updatedChallenges = data.challenges.map((c, i) =>
      i === index ? { ...c, status: 'accepted' } : c
    );
    tx.update(aiRef, { challenges: updatedChallenges });

    return { status: 'accepted' };
  });
}

/**
 * Completes an accepted suggestion: awards its XP to the user and marks it
 * 'completed', both inside one Firestore transaction (same shape as
 * challengeService.completeChallenge). Fires title/rank re-evaluation
 * afterward since the XP gain can cross a rank or title threshold.
 */
async function completeAISuggestion(userId, index) {
  const aiRef = db.collection('aiCache').doc(userId);
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const [aiSnap, userSnap] = await Promise.all([tx.get(aiRef), tx.get(userRef)]);

    if (!aiSnap.exists) throw new AppError('Suggestions not found', 404);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const data = aiSnap.data();
    if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

    const challenge = data.challenges?.[index];
    if (!challenge) throw new AppError('Suggestion not found', 404);

    const status = challenge.status ?? 'suggested';
    if (status === 'completed') return { alreadyCompleted: true };
    if (status !== 'accepted') {
      throw new AppError('Suggestion must be accepted before it can be completed', 409);
    }
    if (challenge.subtasks?.length) {
      throw new AppError('Complete the checklist to finish this suggestion', 409);
    }

    const updatedChallenges = data.challenges.map((c, i) =>
      i === index ? { ...c, status: 'completed' } : c
    );

    const { updates, result: xpResult } = computeXpGain(userSnap.data(), challenge.xpReward);

    tx.update(aiRef, { challenges: updatedChallenges });
    tx.update(userRef, updates);

    return { completed: true, xp: xpResult };
  });

  if (result.completed) {
    evaluateTitles(userId).catch((e) => logger.error({ err: e, userId }, 'Title evaluation failed'));
    updateUserRank(userId).catch((e) => logger.error({ err: e, userId }, 'Rank update failed'));
  }

  return result;
}

/**
 * Generates and persists a 3-5 item action checklist for an accepted
 * suggestion. Idempotent: if subtasks already exist for this index, returns
 * them without calling the AI again. The AI call runs outside any
 * transaction (external I/O shouldn't run inside a retryable transaction
 * body); a narrow follow-up transaction re-checks the suggestion is still
 * 'accepted' before writing, so a suggestion that changed state while the
 * AI call was in flight doesn't get corrupted.
 */
async function generateSubtasks(userId, index) {
  const aiRef = db.collection('aiCache').doc(userId);
  const snap = await aiRef.get();
  if (!snap.exists) throw new AppError('Suggestions not found', 404);

  const data = snap.data();
  if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

  const challenge = data.challenges?.[index];
  if (!challenge) throw new AppError('Suggestion not found', 404);
  if (challenge.status !== 'accepted') {
    throw new AppError('Suggestion must be accepted before generating a checklist', 409);
  }
  if (challenge.subtasks) return challenge.subtasks;

  const prompt = buildSubtasksPrompt(challenge);
  const raw = await callAI(prompt, JSON.stringify(DEFAULT_SUBTASKS));

  let subtasks;
  try {
    subtasks = parseSubtasksJSON(raw);
    if (!subtasks) throw new Error('Empty parse');
  } catch {
    logger.error('[AI] Subtask parse failed, using default');
    subtasks = DEFAULT_SUBTASKS.map((title) => ({ title, completed: false }));
  }

  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(aiRef);
    const freshData = freshSnap.data();
    if (freshData.date !== todayStr() || freshData.challenges?.[index]?.status !== 'accepted') return;
    const updated = freshData.challenges.map((c, i) => (i === index ? { ...c, subtasks } : c));
    tx.update(aiRef, { challenges: updated });
  });

  return subtasks;
}

/**
 * Toggles one subtask's completed flag. If this toggle results in every
 * subtask being complete, auto-completes the suggestion and awards its XP
 * in the same transaction (mirrors completeAISuggestion's transaction
 * shape) — no separate manual "complete" step in the normal flow.
 */
async function toggleSubtask(userId, index, subIndex) {
  const aiRef = db.collection('aiCache').doc(userId);
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const [aiSnap, userSnap] = await Promise.all([tx.get(aiRef), tx.get(userRef)]);
    if (!aiSnap.exists) throw new AppError('Suggestions not found', 404);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const data = aiSnap.data();
    if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

    const challenge = data.challenges?.[index];
    if (!challenge) throw new AppError('Suggestion not found', 404);
    if (challenge.status === 'completed') {
      throw new AppError('Suggestion already completed', 409);
    }
    if (challenge.status !== 'accepted' || !challenge.subtasks?.[subIndex]) {
      throw new AppError('Subtask not found', 404);
    }

    const updatedSubtasks = challenge.subtasks.map((s, i) =>
      i === subIndex ? { ...s, completed: !s.completed } : s
    );
    const allComplete = updatedSubtasks.every((s) => s.completed);

    if (!allComplete) {
      const updatedChallenges = data.challenges.map((c, i) =>
        i === index ? { ...c, subtasks: updatedSubtasks } : c
      );
      tx.update(aiRef, { challenges: updatedChallenges });
      return { subtasks: updatedSubtasks, completed: false };
    }

    const { updates, result: xpResult } = computeXpGain(userSnap.data(), challenge.xpReward);
    const updatedChallenges = data.challenges.map((c, i) =>
      i === index ? { ...c, subtasks: updatedSubtasks, status: 'completed' } : c
    );
    tx.update(aiRef, { challenges: updatedChallenges });
    tx.update(userRef, updates);

    return { subtasks: updatedSubtasks, completed: true, xp: xpResult };
  });

  if (result.completed) {
    evaluateTitles(userId).catch((e) => logger.error({ err: e, userId }, 'Title evaluation failed'));
    updateUserRank(userId).catch((e) => logger.error({ err: e, userId }, 'Rank update failed'));
  }

  return result;
}

module.exports = { generateInsight, generateChallenges, acceptChallenge, completeAISuggestion, generateSubtasks, toggleSubtask };
