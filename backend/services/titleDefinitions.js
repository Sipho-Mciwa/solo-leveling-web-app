// ─── Title Definitions ────────────────────────────────────────────────────────
// Central config for all titles. IDs are the persistent identifiers stored in
// Firestore. Legacy titles (old system) were stored as name strings; those remain
// as-is and the frontend falls back to displaying them verbatim.

const TITLE_DEFS = {
  // ── Consistency ───────────────────────────────────────────────────────────
  consistent_i:   { id: 'consistent_i',   name: 'Iron Starter',       category: 'consistency', tier: 1, description: 'Reach a 3-day active streak' },
  consistent_ii:  { id: 'consistent_ii',  name: 'Week Warrior',        category: 'consistency', tier: 2, description: 'Reach a 7-day active streak' },
  consistent_iii: { id: 'consistent_iii', name: 'Fortnight Grinder',   category: 'consistency', tier: 3, description: 'Reach a 14-day active streak' },
  consistent_iv:  { id: 'consistent_iv',  name: 'Monthly Legend',      category: 'consistency', tier: 4, description: 'Reach a 30-day active streak' },

  // ── Running ───────────────────────────────────────────────────────────────
  runner_i:   { id: 'runner_i',   name: 'First Strides',    category: 'running', tier: 1, description: 'Complete your first tracked run' },
  runner_ii:  { id: 'runner_ii',  name: 'Road Warrior',     category: 'running', tier: 2, description: 'Complete 10 tracked runs' },
  runner_iii: { id: 'runner_iii', name: 'Distance Hunter',  category: 'running', tier: 3, description: 'Run 100 km total (all-time)' },
  runner_iv:  { id: 'runner_iv',  name: 'Iron Legs',        category: 'running', tier: 4, description: 'Run 200 km total (all-time)' },

  // ── Discipline ────────────────────────────────────────────────────────────
  discipline_i:   { id: 'discipline_i',   name: 'Daily Perfectionist', category: 'discipline', tier: 1, description: 'Complete all 6 challenges in one day' },
  discipline_ii:  { id: 'discipline_ii',  name: 'Ironclad',            category: 'discipline', tier: 2, description: 'Complete all 6 challenges 3 days in a row' },
  discipline_iii: { id: 'discipline_iii', name: 'Routine Master',      category: 'discipline', tier: 3, description: 'Complete all 6 challenges 7 days in a row' },
  discipline_iv:  { id: 'discipline_iv',  name: 'Shadow Disciple',     category: 'discipline', tier: 4, description: 'Complete all 6 challenges on 30 different days' },

  // ── Intellect ─────────────────────────────────────────────────────────────
  intellect_i:   { id: 'intellect_i',   name: 'Scholar',          category: 'intellect', tier: 1, description: 'Read 10 pages on 7 different days' },
  intellect_ii:  { id: 'intellect_ii',  name: 'Avid Reader',      category: 'intellect', tier: 2, description: 'Read 10 pages on 20 different days' },
  intellect_iii: { id: 'intellect_iii', name: 'Knowledge Hunter', category: 'intellect', tier: 3, description: 'Read 10 pages on 50 different days' },
  intellect_iv:  { id: 'intellect_iv',  name: 'Mind of Shadow',   category: 'intellect', tier: 4, description: 'Read 10 pages 7 consecutive days' },

  // ── Recovery ──────────────────────────────────────────────────────────────
  recovery_i:   { id: 'recovery_i',   name: "Shadow's Return",  category: 'recovery', tier: 1, description: 'Return after a broken streak' },
  recovery_ii:  { id: 'recovery_ii',  name: 'Unyielding',       category: 'recovery', tier: 2, description: 'Recover from a broken streak 3 times' },
  recovery_iii: { id: 'recovery_iii', name: 'Resilient Hunter', category: 'recovery', tier: 3, description: 'Recover from a broken streak 5 times' },
  recovery_iv:  { id: 'recovery_iv',  name: 'Phoenix',          category: 'recovery', tier: 4, description: 'Recover from a broken streak 10 times' },

  // ── Boss ──────────────────────────────────────────────────────────────────
  boss_i:   { id: 'boss_i',   name: 'Challenger',      category: 'boss', tier: 1, description: 'Complete your first boss quest' },
  boss_ii:  { id: 'boss_ii',  name: 'Boss Slayer',     category: 'boss', tier: 2, description: 'Complete 3 boss quests' },
  boss_iii: { id: 'boss_iii', name: 'Raid Captain',    category: 'boss', tier: 3, description: 'Complete 7 boss quests' },
  boss_iv:  { id: 'boss_iv',  name: 'Dungeon Breaker', category: 'boss', tier: 4, description: 'Complete 15 boss quests' },

  // ── Rare ──────────────────────────────────────────────────────────────────
  beast_mode:     { id: 'beast_mode',     name: 'Beast Mode',     category: 'rare', tier: 'rare', description: 'Complete all quests and all 6 challenges on the same day' },
  perfect_week:   { id: 'perfect_week',   name: 'Perfect Week',   category: 'rare', tier: 'rare', description: '100% quest completion for 7 consecutive days' },
  early_riser:    { id: 'early_riser',    name: 'Early Riser',    category: 'rare', tier: 'rare', description: 'Wake up at 5:00 AM on 14 different days' },
  shadow_monarch: { id: 'shadow_monarch', name: 'Shadow Monarch', category: 'rare', tier: 'rare', description: 'Reach S-Rank' },
};

const TITLE_CATEGORIES = ['consistency', 'running', 'discipline', 'intellect', 'recovery', 'boss', 'rare'];

// Ordered list of IDs per category (tier order, rare last)
const CATEGORY_ORDER = Object.fromEntries(
  TITLE_CATEGORIES.map((cat) => [
    cat,
    Object.values(TITLE_DEFS)
      .filter((t) => t.category === cat)
      .sort((a, b) => {
        if (a.tier === 'rare') return 1;
        if (b.tier === 'rare') return -1;
        return a.tier - b.tier;
      })
      .map((t) => t.id),
  ])
);

module.exports = { TITLE_DEFS, TITLE_CATEGORIES, CATEGORY_ORDER };
