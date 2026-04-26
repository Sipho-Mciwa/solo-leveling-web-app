// ─── System Tone Styles ───────────────────────────────────────────────────────
// Maps tone states to Tailwind classes and Framer Motion glow values.
// Used by SystemMessage and any component that needs tone-tied visual feedback.

export type ToneState = 'stable' | 'warning' | 'critical' | 'info';

export interface ToneConfig {
  border:  string;
  bg:      string;
  text:    string;
  glowOn:  string;
  glowOff: string;
}

export const TONE_STYLES: Record<ToneState, ToneConfig> = {
  stable: {
    border:  'border-green-500/30',
    bg:      'bg-green-500/[0.05]',
    text:    'text-green-400/90',
    glowOn:  '0 0 14px rgba(74,222,128,0.12)',
    glowOff: '0 0 0px rgba(74,222,128,0)',
  },
  warning: {
    border:  'border-amber-400/50',
    bg:      'bg-amber-400/[0.05]',
    text:    'text-amber-300/90',
    glowOn:  '0 0 16px rgba(251,191,36,0.22)',
    glowOff: '0 0 4px rgba(251,191,36,0.06)',
  },
  critical: {
    border:  'border-red-500/60',
    bg:      'bg-red-500/[0.07]',
    text:    'text-red-400/90',
    glowOn:  '0 0 20px rgba(239,68,68,0.28)',
    glowOff: '0 0 6px rgba(239,68,68,0.08)',
  },
  info: {
    border:  'border-sky-400/35',
    bg:      'bg-sky-400/[0.04]',
    text:    'text-sky-300/90',
    glowOn:  '0 0 0px rgba(56,189,248,0)',
    glowOff: '0 0 0px rgba(56,189,248,0)',
  },
};

/** Glow cycle duration per tone state (seconds). */
export const GLOW_DURATION: Record<ToneState, number> = {
  stable:   3.2,
  warning:  2.4,
  critical: 1.6,
  info:     0,
};

/** One-time shake keyframes per tone (used for x animation). */
export const SHAKE_X: Partial<Record<ToneState, number[]>> = {
  warning:  [0, -3,  3, -1.5, 1.5, 0],
  critical: [0, -5,  5, -3,   3,  -1, 1, 0],
};

/** Classify an insight/message string into a tone state. */
export function classifyInsightTone(text: string): ToneState {
  const t = text.toLowerCase();
  if (/critical|minimum viable|below minimum|immediate protocol|penalty protocol/.test(t)) {
    return 'critical';
  }
  if (/below acceptable|insufficient|deviation|setback|adjustment|correction|prioritize|remaining/.test(t)) {
    return 'warning';
  }
  if (/optimal|complete|elite|balanced|within acceptable|within optimal|consistent|stable/.test(t)) {
    return 'stable';
  }
  return 'info';
}

/** Map SystemEvent type strings to tone states. */
export function eventTypeToTone(type: string): ToneState {
  switch (type) {
    case 'alert':     return 'critical';
    case 'warning':   return 'warning';
    case 'narrative': return 'info';
    case 'special':   return 'info';
    default:          return 'stable';
  }
}
