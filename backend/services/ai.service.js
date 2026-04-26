const { db } = require('../config/firebase');
const { getMemory } = require('./aiMemory.service');
const { VOICE_INSTRUCTION, FALLBACKS, buildMemoryBlock } = require('./systemVoice');

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_INSIGHT = FALLBACKS.insight;
const DEFAULT_CHALLENGES = [
  {
    title: 'Complete all daily protocols',
    description: FALLBACKS.challenge,
    xpReward: 25,
  },
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
    console.error('[AI] Cache read error:', e.message);
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
    console.error('[AI] Cache write error:', e.message);
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
      console.error('[AI] Gemini failed:', e.message);
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(prompt);
    } catch (e) {
      console.error('[AI] Groq failed:', e.message);
    }
  }
  console.warn('[AI] All providers failed — using default response');
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
- No running or distance protocols (tracked separately via Strava)
- If historical patterns are available, target the highest-miss protocol or lowest output day`;
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
    console.error('[AI] Challenge parse failed, using default');
    challenges = DEFAULT_CHALLENGES;
  }

  const current = await getCachedAI(userId);
  await setCachedAI(userId, current?.insight || null, challenges);

  return challenges;
}

module.exports = { generateInsight, generateChallenges };
