export const ACHIEVEMENT_MAP: Record<string, string> = {
  consistent_i:   'Iron Starter',
  consistent_ii:  'Week Warrior',
  consistent_iii: 'Fortnight Grinder',
  consistent_iv:  'Monthly Legend',
  runner_i:       'First Strides',
  runner_ii:      'Road Warrior',
  runner_iii:     'Distance Hunter',
  runner_iv:      'Iron Legs',
  discipline_i:   'Daily Perfectionist',
  discipline_ii:  'Ironclad',
  discipline_iii: 'Routine Master',
  discipline_iv:  'Shadow Disciple',
  intellect_i:    'Scholar',
  intellect_ii:   'Avid Reader',
  intellect_iii:  'Knowledge Hunter',
  intellect_iv:   'Mind of Shadow',
  recovery_i:     "Shadow's Return",
  recovery_ii:    'Unyielding',
  recovery_iii:   'Resilient Hunter',
  recovery_iv:    'Phoenix',
  boss_i:         'Challenger',
  boss_ii:        'Boss Slayer',
  boss_iii:       'Raid Captain',
  boss_iv:        'Dungeon Breaker',
  beast_mode:     'Beast Mode',
  perfect_week:   'Perfect Week',
  early_riser:    'Early Riser',
  shadow_monarch: 'Shadow Monarch',
};

export function resolveAchievementName(key: string): string {
  return ACHIEVEMENT_MAP[key] ?? key;
}
