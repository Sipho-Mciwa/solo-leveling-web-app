const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { updateUserRank } = require('./rankService');
const { evaluateTitles } = require('./titleService');

// ─── Boss templates ───────────────────────────────────────────────────────────
// questType    — primary type (used for display and single-type sync)
// mixedTypes   — array of types that all contribute progress (optional)
// unit         — display unit
// baseTarget   — target at level 1 (scaled up per user level)
// labelFn      — optional custom label builder (target) => string

const BOSS_TEMPLATES = [
  // ── Push-ups ─────────────────────────────────────────────────────────────
  {
    title:      "Shadow Monarch's Trial",
    flavour:    "The Shadow Monarch watches. Every rep is a vow carved into your flesh. There is no audience here — only the weight of who you are versus who you could become.",
    questType:  'push-ups',
    unit:       'reps',
    baseTarget: 100,
  },
  {
    title:      'Wall of a Thousand Demons',
    flavour:    "A thousand demons stand between you and the gate. You do not break through a wall — you become stronger than it, one push-up at a time, until they part before you.",
    questType:  'push-ups',
    unit:       'reps',
    baseTarget: 150,
  },
  {
    title:      'Iron Fist Protocol',
    flavour:    "The dungeon floor is your arena. No gloves. No mercy. No shortcuts. The only thing standing between you and the other side is the number of times you refuse to stay down.",
    questType:  'push-ups',
    unit:       'reps',
    baseTarget: 200,
  },
  {
    title:      "Demon King's Challenge",
    flavour:    "A demon king does not negotiate. He does not rest. He presses, rep after rep, until the world bends around his will. This week, you are the demon king.",
    questType:  'push-ups',
    unit:       'reps',
    baseTarget: 250,
  },
  {
    title:      "The Hunter's Oath",
    flavour:    "You swore on blood to rise beyond human limits. Oaths are not spoken — they are paid back in sweat, muscle failure, and the quiet refusal to stop.",
    questType:  'push-ups',
    unit:       'reps',
    baseTarget: 300,
  },

  // ── Sit-ups ───────────────────────────────────────────────────────────────
  {
    title:      'Core of Steel',
    flavour:    "Your core is the foundation of everything you are. Legs, arms, spine — they all answer to the centre. If it breaks, you break. This week, forge it so nothing ever breaks again.",
    questType:  'sit-ups',
    unit:       'reps',
    baseTarget: 100,
  },
  {
    title:      'The Foundation Test',
    flavour:    "A cracked foundation brings down the strongest fortress in time. Strip it back to stone. Rebuild it from the ground up, rep by rep, until no force in any dungeon can shake it.",
    questType:  'sit-ups',
    unit:       'reps',
    baseTarget: 150,
  },
  {
    title:      'Abyss Core Training',
    flavour:    "The abyss does not care about your comfort zone. It swallows hunters who drift through the middle. This week you train at the edge — where the reps are hard and the growth is real.",
    questType:  'sit-ups',
    unit:       'reps',
    baseTarget: 200,
  },
  {
    title:      'Iron Gut Protocol',
    flavour:    "Shadow soldiers absorb blows without flinching because their cores were forged before the battle ever started. The gut that takes the hit and holds the line — that is the only gut worth having.",
    questType:  'sit-ups',
    unit:       'reps',
    baseTarget: 250,
  },

  // ── Squats ────────────────────────────────────────────────────────────────
  {
    title:      'Throne of Endurance',
    flavour:    "Kings do not sit on thrones. They earn them — rep by rep, until their legs shake and they stand anyway. The throne belongs to whoever refuses to sit down.",
    questType:  'squats',
    unit:       'reps',
    baseTarget: 100,
  },
  {
    title:      'Siege Stance',
    flavour:    "Before you breach the gate, you must be able to hold your ground under any weight. This week, you plant your feet and you do not move — no matter what comes at you.",
    questType:  'squats',
    unit:       'reps',
    baseTarget: 150,
  },
  {
    title:      "The Warlord's Foundation",
    flavour:    "No warlord ever won a war with weak legs. His power comes from the ground — from legs that carry armies, outlast sieges, and plant him unmovable in the field. Build the foundation his enemies fear.",
    questType:  'squats',
    unit:       'reps',
    baseTarget: 200,
  },
  {
    title:      "Giants' Method",
    flavour:    "Giants are not born taller than the rest. They are built through relentless, grinding repetition — rep by rep, day by day, until they look down at the world they used to look up at.",
    questType:  'squats',
    unit:       'reps',
    baseTarget: 300,
  },

  // ── Running ───────────────────────────────────────────────────────────────
  {
    title:      'Run from the Abyss',
    flavour:    "Death itself gives chase through the dungeon corridor. It does not tire. It does not negotiate. There is only one option — run, and do not stop until you have left it behind completely.",
    questType:  'running',
    unit:       'km',
    baseTarget: 5,
  },
  {
    title:      "Predator's Pace",
    flavour:    "In the dungeon, you are either the predator or the prey. The predator sets the pace. The prey tries to keep up. This week, decide which one you are and run like it.",
    questType:  'running',
    unit:       'km',
    baseTarget: 8,
  },
  {
    title:      "Gate Breaker's March",
    flavour:    "Gates do not open for hunters who stop. Every kilometre you run this week is a step deeper into territory no one else dared enter. Your legs remember what they were built for.",
    questType:  'running',
    unit:       'km',
    baseTarget: 10,
  },
  {
    title:      "World's End Sprint",
    flavour:    "The world ends where your limits do. Most hunters never find out where that is — they stop before the edge. You do not stop. You find the edge and step past it.",
    questType:  'running',
    unit:       'km',
    baseTarget: 12,
  },
  {
    title:      'The Long Hunt',
    flavour:    "The greatest prey never falls quickly. It runs, circles back, and tests your patience against your stamina. The greatest hunters do not sprint — they outlast. Log the distance. Show it who runs out first.",
    questType:  'running',
    unit:       'km',
    baseTarget: 15,
  },
  {
    title:      'Dungeon Marathon',
    flavour:    "Some dungeons stretch on for days — twisting corridors, false exits, walls that seem to breathe. Your legs will know this truth by the end of the week. Every step forward is a step no one else took.",
    questType:  'running',
    unit:       'km',
    baseTarget: 21,
  },
  {
    title:      'The Endless Corridor',
    flavour:    "The deepest dungeons have no visible end. Hunters who enter them either turn back or discover what they are truly made of. You entered. You already chose. Keep going.",
    questType:  'running',
    unit:       'km',
    baseTarget: 30,
  },

  // ── Mixed: Push-ups + Squats ──────────────────────────────────────────────
  {
    title:      "Shadow Knight's Circuit",
    flavour:    "A Shadow Knight does not train one muscle group while the others decay. Upper body pushes. Lower body drives. This week, you build both ends of the chain — because the weakest link is where the enemy attacks first.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'squats'],
    unit:       'reps',
    baseTarget: 300,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups and squats`,
  },
  {
    title:      'Shadow Army Assembly',
    flavour:    "An army of shadows answers to one thing: absolute physical readiness. Every push-up raises a soldier. Every squat plants their feet in the ground. Build your army this week — rep by rep, soldier by soldier.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'squats'],
    unit:       'reps',
    baseTarget: 400,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups and squats`,
  },

  // ── Mixed: Push-ups + Sit-ups ─────────────────────────────────────────────
  {
    title:      'Total Body Purge',
    flavour:    "Front and back. Push and pull. No muscle group is spared. This week, the body does not get to hide behind its strongest part — everything answers for everything else.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'sit-ups'],
    unit:       'reps',
    baseTarget: 200,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups and sit-ups`,
  },
  {
    title:      "The Gladiator's Standard",
    flavour:    "In the arena, there are no weak spots. Gladiators are cut down through the gap between their strength and their core. Close that gap before someone else finds it.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'sit-ups'],
    unit:       'reps',
    baseTarget: 300,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups and sit-ups`,
  },

  // ── Mixed: Squats + Sit-ups ───────────────────────────────────────────────
  {
    title:      'Lower Body Verdict',
    flavour:    "The verdict is in — your lower body and core have been judged and found insufficient. This is the sentence: complete every rep assigned, no negotiation, no appeal, no early release.",
    questType:  'squats',
    mixedTypes: ['squats', 'sit-ups'],
    unit:       'reps',
    baseTarget: 300,
    labelFn:    (t) => `Complete ${t} combined reps across squats and sit-ups`,
  },

  // ── Mixed: Push-ups + Squats + Sit-ups ───────────────────────────────────
  {
    title:      "The Sovereign's Gauntlet",
    flavour:    "Sovereigns do not specialise. They command every domain: strength, endurance, power, discipline. Push-ups, squats, sit-ups — master all three this week and prove your right to the title.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'squats', 'sit-ups'],
    unit:       'reps',
    baseTarget: 300,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups, squats, and sit-ups`,
  },
  {
    title:      "The Awakening Trial",
    flavour:    "Every S-Rank hunter can name the trial that broke them open — the week when everything hurt and they chose not to stop. No single movement, no favourites. Everything at once. This is that week.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'squats', 'sit-ups'],
    unit:       'reps',
    baseTarget: 500,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups, squats, and sit-ups`,
  },
  {
    title:      'Full Spectrum Protocol',
    flavour:    "Elite hunters train every system simultaneously. Weak hunters cherry-pick. This protocol accepts no cherry-pickers — every muscle group shows up or the whole protocol fails.",
    questType:  'push-ups',
    mixedTypes: ['push-ups', 'squats', 'sit-ups'],
    unit:       'reps',
    baseTarget: 450,
    labelFn:    (t) => `Complete ${t} combined reps across push-ups, squats, and sit-ups`,
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
  const d    = new Date();
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function buildDescription(template, targetValue) {
  const label = template.labelFn
    ? template.labelFn(targetValue)
    : template.questType === 'running'
    ? `Run ${targetValue} km`
    : `Complete ${targetValue} ${template.questType}`;
  return `${template.flavour} ${label} before the week ends to claim victory.`;
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

  // All users face the same boss each week — rotate by week number
  const weekNum  = getISOWeekNumber();
  const template = BOSS_TEMPLATES[weekNum % BOSS_TEMPLATES.length];

  // Scale target: +10% per level beyond 1, capped at 3×
  const scaleFactor = Math.min(1 + (level - 1) * 0.1, 3);
  const targetValue = Math.round(template.baseTarget * scaleFactor);
  const xpReward    = Math.min(500 + level * 20, 1500);

  const bossData = {
    userId,
    weekStart,
    title:        template.title,
    description:  buildDescription(template, targetValue),
    questType:    template.questType,
    mixedTypes:   template.mixedTypes ?? null,
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

  let xpResult = null;
  if (isComplete) {
    xpResult = await addXp(userId, boss.xpReward);
    updateUserRank(userId).catch((e) => console.error('[RankService] update error:', e));
    evaluateTitles(userId).catch((e) => console.error('[TitleService] eval error:', e));
  }

  return { completed: isComplete, currentValue: clampedValue, xp: xpResult };
}

/**
 * Called automatically when a daily quest is updated.
 * Adds the logged delta to boss progress if the quest type matches.
 * Handles both single-type and mixed-type bosses.
 */
async function syncBossFromQuest(userId, questTitle, delta) {
  if (delta <= 0) return;

  const { boss } = await getCurrentBoss(userId);
  if (!boss || boss.completed) return;

  // Determine which types contribute to this boss
  const activeTypes = boss.mixedTypes ?? [boss.questType];
  if (!activeTypes.includes(questTitle.toLowerCase())) return;

  const newValue   = Math.min(boss.currentValue + delta, boss.targetValue);
  const isComplete = newValue >= boss.targetValue;

  await db.collection('bossQuests').doc(boss.id).update({
    currentValue: newValue,
    completed:    isComplete,
  });

  if (isComplete) {
    await addXp(userId, boss.xpReward);
    updateUserRank(userId).catch((e) => console.error('[RankService] update error:', e));
    evaluateTitles(userId).catch((e) => console.error('[TitleService] eval error:', e));
  }
}

module.exports = { generateBossQuest, getCurrentBoss, updateBossProgress, syncBossFromQuest };
