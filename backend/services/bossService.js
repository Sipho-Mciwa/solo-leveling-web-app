const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { updateUserRank } = require('./rankService');

// ─── Boss templates (rotates weekly) ─────────────────────────────────────────

const BOSS_TEMPLATES = [
  {
    title:       "Shadow Monarch's Trial",
    flavour:     'The Shadow Monarch watches. Prove your body is iron.',
    questType:   'push-ups',
    unit:        'reps',
    baseTarget:  100,
  },
  {
    title:       'Run from the Abyss',
    flavour:     'Death itself gives chase. There is only one option — run.',
    questType:   'running',
    unit:        'km',
    baseTarget:  5,
  },
  {
    title:       'Core of Steel',
    flavour:     'Your core must be unbreakable to survive what comes next.',
    questType:   'sit-ups',
    unit:        'reps',
    baseTarget:  100,
  },
  {
    title:       'Throne of Endurance',
    flavour:     'Kings do not sit on thrones. They earn them.',
    questType:   'squats',
    unit:        'reps',
    baseTarget:  100,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns ISO week number (1–53). */
function getISOWeekNumber() {
  const d    = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/** Returns YYYY-MM-DD of the Monday of the current week. */
function getMondayOfCurrentWeek() {
  const d   = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate this week's boss quest for a user if it doesn't exist yet.
 * Called on login.
 */
async function generateBossQuest(userId) {
  const weekStart = getMondayOfCurrentWeek();

  const existing = await db
    .collection('bossQuests')
    .where('userId', '==', userId)
    .where('weekStart', '==', weekStart)
    .limit(1)
    .get();

  if (!existing.empty) return { generated: false };

  const userSnap = await db.collection('users').doc(userId).get();
  const user     = userSnap.exists ? userSnap.data() : { level: 1 };
  const level    = user.level || 1;

  // Pick template based on week number so all users face the same boss
  const weekNum  = getISOWeekNumber();
  const template = BOSS_TEMPLATES[weekNum % BOSS_TEMPLATES.length];

  // Scale target: +10% per level beyond 1, capped at 3×
  const scaleFactor = Math.min(1 + (level - 1) * 0.1, 3);
  const targetValue = Math.round(template.baseTarget * scaleFactor);
  const xpReward    = Math.min(500 + level * 20, 1500);

  const questLabel =
    template.questType === 'running'
      ? `Run ${targetValue} km`
      : `Complete ${targetValue} ${template.questType}`;

  const description = `${template.flavour} ${questLabel} before the week ends to claim victory.`;

  const bossData = {
    userId,
    weekStart,
    title:        template.title,
    description,
    questType:    template.questType,
    unit:         template.unit,
    targetValue,
    currentValue: 0,
    xpReward,
    completed:    false,
    difficulty:   Math.round(scaleFactor * 100) / 100,
  };

  const ref = db.collection('bossQuests').doc();
  await ref.set(bossData);

  return { generated: true, boss: { id: ref.id, ...bossData } };
}

/** Returns this week's boss quest, or null if not yet generated. */
async function getCurrentBoss(userId) {
  const weekStart = getMondayOfCurrentWeek();

  const snap = await db
    .collection('bossQuests')
    .where('userId', '==', userId)
    .where('weekStart', '==', weekStart)
    .limit(1)
    .get();

  if (snap.empty) return { boss: null };
  const doc = snap.docs[0];
  return { boss: { id: doc.id, ...doc.data() } };
}

/** Update progress on the boss quest. Awards XP + updates rank on completion. */
async function updateBossProgress(bossId, userId, newValue) {
  const ref  = db.collection('bossQuests').doc(bossId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Boss quest not found');

  const boss = snap.data();
  if (boss.userId !== userId) throw new Error('Unauthorized');
  if (boss.completed)         return { alreadyCompleted: true };

  const clampedValue = Math.min(newValue, boss.targetValue);
  const isComplete   = clampedValue >= boss.targetValue;

  await ref.update({ currentValue: clampedValue, completed: isComplete });

  let xpResult   = null;
  let rankResult = null;

  if (isComplete) {
    xpResult   = await addXp(userId, boss.xpReward);
    rankResult = await updateUserRank(userId);
  }

  return {
    completed:    isComplete,
    currentValue: clampedValue,
    xp:           xpResult,
    rank:         rankResult,
  };
}

/**
 * Called automatically when a daily quest is updated.
 * If the quest type matches the active boss, the logged delta is added to boss progress.
 */
async function syncBossFromQuest(userId, questTitle, delta) {
  if (delta <= 0) return;

  const { boss } = await getCurrentBoss(userId);
  if (!boss || boss.completed) return;

  // 'Push-ups' → 'push-ups', 'Sit-ups' → 'sit-ups', 'Running' → 'running', etc.
  if (questTitle.toLowerCase() !== boss.questType) return;

  const newValue  = Math.min(boss.currentValue + delta, boss.targetValue);
  const isComplete = newValue >= boss.targetValue;

  await db.collection('bossQuests').doc(boss.id).update({
    currentValue: newValue,
    completed:    isComplete,
  });

  if (isComplete) {
    await addXp(userId, boss.xpReward);
    await updateUserRank(userId);
  }
}

module.exports = { generateBossQuest, getCurrentBoss, updateBossProgress, syncBossFromQuest };
