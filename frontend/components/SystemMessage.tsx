'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToneState, TONE_STYLES, GLOW_DURATION, SHAKE_X } from '@/utils/systemStyles';

interface Props {
  tone:      ToneState;
  children:  React.ReactNode;
  className?: string;
  /** Trigger a full-screen red flash on mount — opt-in, only for explicitly critical contexts. */
  flash?:    boolean;
}

export default function SystemMessage({ tone, children, className = '', flash = false }: Props) {
  const s            = TONE_STYLES[tone];
  const [showFlash, setShowFlash] = useState(false);
  const shouldShake  = tone === 'warning' || tone === 'critical';
  const hasGlow      = tone !== 'info';
  const glowDuration = GLOW_DURATION[tone];

  useEffect(() => {
    if (flash && tone === 'critical') {
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [flash, tone]);

  return (
    <>
      {/* Screen flash — pointer-events-none so it never blocks interaction */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            key="screen-flash"
            initial={{ opacity: 0.16 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="fixed inset-0 z-[60] bg-red-500 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: tone === 'info' ? 0 : 1, x: 0 }}
        animate={{
          opacity: 1,
          x: shouldShake ? SHAKE_X[tone]! : 0,
          ...(hasGlow && { boxShadow: [s.glowOff, s.glowOn, s.glowOff] }),
        }}
        transition={{
          opacity:   { duration: 0.45 },
          x:         shouldShake
            ? { duration: 0.5, ease: 'easeInOut' }
            : { duration: 0 },
          boxShadow: hasGlow
            ? { duration: glowDuration, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0 },
        }}
        className={`rounded-xl border ${s.border} ${s.bg} ${className}`}
      >
        {children}
      </motion.div>
    </>
  );
}
