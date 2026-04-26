const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { updateUserRank } = require('./rankService');
const { evaluateTitles } = require('./titleService');
const { getMemory } = require('./aiMemory.service');
const { VOICE_INSTRUCTION, FALLBACKS } = require('./systemVoice');

// ─── Weekend helpers ───────────────────────────────────────────────────────────

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6; // 0=Sun, 6=Sat
}

/** Returns the Saturday of the current weekend as YYYY-MM-DD (the weekend identifier). */
function getWeekendId() {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -1 : day === 6 ? 0 : null;
  if (offset === null) return null;
  const sat = new Date(now);
  sat.setDate(now.getDate() + offset);
  return sat.toISOString().split('T')[0];
}

/** Returns Date at Sunday 23:59:59 of the current weekend. */
function getWeekendEnd() {
  const now = new Date();
  const day = now.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const end = new Date(now);
  end.setDate(now.getDate() + daysToSunday);
  end.setHours(23, 59, 59, 999);
  return end;
}

// ─── AI provider ─────────────────────────────────────────────────────────────

async function callAI(prompt) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      console.error('[WeekendBoss] Gemini failed:', e.message);
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.85,
      });
      return completion.choices[0].message.content.trim();
    } catch (e) {
      console.error('[WeekendBoss] Groq failed:', e.message);
    }
  }
  return null;
}

// ─── Prompt + parse ───────────────────────────────────────────────────────────

const RANK_REQUIREMENTS = {
  E: { runMin: 3,  runMax: 5,  repsMin: 50,  repsMax: 100, xpMin: 200, xpMax: 280 },
  D: { runMin: 5,  runMax: 8,  repsMin: 100, repsMax: 150, xpMin: 260, xpMax: 340 },
  C: { runMin: 7,  runMax: 10, repsMin: 150, repsMax: 200, xpMin: 320, xpMax: 420 },
  B: { runMin: 10, runMax: 12, repsMin: 200, repsMax: 250, xpMin: 400, xpMax: 500 },
  A: { runMin: 12, runMax: 15, repsMin: 250, repsMax: 300, xpMin: 480, xpMax: 580 },
  S: { runMin: 15, runMax: 25, repsMin: 300, repsMax: 500, xpMin: 550, xpMax: 700 },
};

function buildBossPrompt(user, memory) {
  const rank        = user.rank || 'E';
  const req         = RANK_REQUIREMENTS[rank] || RANK_REQUIREMENTS.E;
  const missedHabit = memory?.patterns?.mostMissedHabitTitle || 'unrecorded';
  const trend       = memory?.patterns?.avgCompletionLast7 != null
    ? `${memory.patterns.avgCompletionLast7}% 7-day completion`
    : 'unrecorded';

  return `${VOICE_INSTRUCTION}

You are generating a weekend boss entry for a Solo Leveling fitness application. The boss is an in-world entity — output a System threat assessment report.

Hunter data:
- Rank: ${rank}, Level: ${user.level || 1}, Streak: ${user.streakCount || 0} days
- Recent output: ${trend}
- Highest-miss protocol: ${missedHabit}
- Performance trend: ${memory?.trends?.questCompletion || 'unrecorded'}

Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Entity designation (2-5 words, dramatic Solo Leveling classification)",
  "description": "2 sentences. System threat assessment of the entity. Clinical and precise — state classification, threat level, and engagement parameters.",
  "flavourText": "1 sentence. System engagement directive. State what is required to neutralize the entity.",
  "requirements": {
    "type": "run",
    "label": "Execute: Run 6km before the window closes",
    "minValue": 6,
    "unit": "km"
  },
  "xpReward": 320
}

Strict rules:
- type must be "run" OR "reps" (no other values)
- For "run": minValue between ${req.runMin} and ${req.runMax}, unit = "km"
- For "reps": minValue between ${req.repsMin} and ${req.repsMax}, unit = "reps" (push-ups, squats, or sit-ups — specify in label)
- xpReward between ${req.xpMin} and ${req.xpMax}
- label must begin with "Execute:" and include the exact number and unit
- description and flavourText must follow system voice — no emotional language, no motivational phrases`;
}

function parseBossJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);

  const req = parsed.requirements;
  if (!req || !['run', 'reps'].includes(req.type)) return null;
  if (typeof req.minValue !== 'number' || req.minValue <= 0) return null;

  return {
    title: String(parsed.title || '').trim(),
    description: String(parsed.description || '').trim(),
    flavourText: String(parsed.flavourText || '').trim(),
    requirements: {
      type: req.type,
      label: String(req.label || '').trim(),
      minValue: Number(req.minValue),
      unit: String(req.unit || (req.type === 'run' ? 'km' : 'reps')),
    },
    xpReward: Math.max(150, Math.min(800, Number(parsed.xpReward) || 300)),
  };
}

const DEFAULT_BOSS = {
  title:       FALLBACKS.boss.title,
  description: FALLBACKS.boss.description,
  flavourText: FALLBACKS.boss.flavourText,
  requirements: {
    type:     'reps',
    label:    'Execute: Complete 100 push-ups before the window closes',
    minValue: 100,
    unit:     'reps',
  },
  xpReward: 300,
};

// ─── Core functions ───────────────────────────────────────────────────────────

async function generateWeekendBoss(userId) {
  if (!isWeekend()) {
    return { generated: false, reason: 'Weekend bosses only appear on Saturday and Sunday.' };
  }

  const weekendId = getWeekendId();

  const existing = await db
    .collection('weekendBossChallenges')
    .where('userId', '==', userId)
    .where('weekendId', '==', weekendId)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();
    // Once claimed, hide the boss card from the dashboard
    if (data.status === 'claimed') return { generated: false, boss: null };
    return { generated: false, boss: { id: doc.id, ...data } };
  }

  const [userSnap, memory] = await Promise.all([
    db.collection('users').doc(userId).get(),
    getMemory(userId).catch(() => null),
  ]);
  const user = userSnap.exists ? userSnap.data() : {};

  const prompt = buildBossPrompt(user, memory);
  const raw = await callAI(prompt);

  let bossData = null;
  if (raw) {
    try {
      bossData = parseBossJSON(raw);
    } catch {
      console.error('[WeekendBoss] JSON parse failed');
    }
  }
  if (!bossData) {
    console.warn('[WeekendBoss] Using default boss');
    bossData = DEFAULT_BOSS;
  }

  const endTime = getWeekendEnd();
  const startTime = new Date();

  const doc = {
    userId,
    weekendId,
    ...bossData,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'active',
    submission: null,
    claimedAt: null,
  };

  const ref = db.collection('weekendBossChallenges').doc();
  await ref.set(doc);

  return { generated: true, boss: { id: ref.id, ...doc } };
}

async function getWeekendBoss(userId) {
  const weekendId = getWeekendId();
  if (!weekendId) return { boss: null };

  const snap = await db
    .collection('weekendBossChallenges')
    .where('userId', '==', userId)
    .where('weekendId', '==', weekendId)
    .limit(1)
    .get();

  if (snap.empty) return { boss: null };

  const doc = snap.docs[0];
  const boss = { id: doc.id, ...doc.data() };

  // Once claimed, hide the boss card from the dashboard
  if (boss.status === 'claimed') return { boss: null };

  // Lazy expiry: active boss past its end time → mark expired
  if (boss.status === 'active' && new Date(boss.endTime) < new Date()) {
    await doc.ref.update({ status: 'expired' });
    boss.status = 'expired';
  }

  return { boss };
}

async function completeWeekendBoss(bossId, userId, { value, notes }) {
  const ref = db.collection('weekendBossChallenges').doc(bossId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error('Boss challenge not found');

  const boss = snap.data();
  if (boss.userId !== userId) throw new Error('Unauthorized');

  if (boss.status === 'expired') {
    return { success: false, message: 'Engagement window expired. Entity no longer accessible. No reward available.' };
  }
  if (boss.status === 'claimed') {
    return { success: false, message: 'Reward already claimed. Status: complete.' };
  }
  if (boss.status === 'completed') {
    return { success: false, message: 'Submission recorded. Proceed to claim reward.' };
  }

  // Check expiry
  if (new Date(boss.endTime) < new Date()) {
    await ref.update({ status: 'expired' });
    return { success: false, message: 'Engagement window expired. Entity no longer accessible. No reward available.' };
  }

  const numericValue = Number(value);
  if (isNaN(numericValue) || numericValue <= 0) {
    return { success: false, message: 'Invalid value submitted.' };
  }

  if (numericValue < boss.requirements.minValue) {
    return {
      success: false,
      message: `Output insufficient. Minimum threshold: ${boss.requirements.minValue} ${boss.requirements.unit}. Submission rejected.`,
    };
  }

  const submission = {
    value: numericValue,
    notes: String(notes || '').trim().slice(0, 500),
    submittedAt: new Date().toISOString(),
  };

  await ref.update({ status: 'completed', submission });

  return {
    success: true,
    message: 'Entity neutralized. Output accepted. Proceed to claim reward.',
    xpReward: boss.xpReward,
  };
}

async function claimWeekendReward(bossId, userId) {
  const ref = db.collection('weekendBossChallenges').doc(bossId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error('Boss challenge not found');

  const boss = snap.data();
  if (boss.userId !== userId) throw new Error('Unauthorized');

  if (boss.status !== 'completed') {
    const msg =
      boss.status === 'claimed'  ? 'Reward already claimed. Status: complete.' :
      boss.status === 'expired'  ? 'Engagement window expired. No reward available.' :
                                   'Minimum output threshold not met. Complete the protocol before claiming.';
    return { claimed: false, message: msg };
  }

  await ref.update({ status: 'claimed', claimedAt: new Date().toISOString() });

  const xpResult = await addXp(userId, boss.xpReward);
  updateUserRank(userId).catch((e) => console.error('[WeekendBoss] rank update error:', e));
  evaluateTitles(userId).catch((e) => console.error('[WeekendBoss] title eval error:', e));

  return { claimed: true, xp: xpResult };
}

module.exports = { generateWeekendBoss, getWeekendBoss, completeWeekendBoss, claimWeekendReward };
