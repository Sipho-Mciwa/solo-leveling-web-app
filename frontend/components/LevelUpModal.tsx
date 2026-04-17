'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';

interface LevelUpModalProps {
  newLevel: number;
  previousLevel: number;
  onDismiss: () => void;
}

export default function LevelUpModal({ newLevel, previousLevel, onDismiss }: LevelUpModalProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onDismiss}
    >
      {/* Dimmed backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Flash on entry */}
      <motion.div
        className="absolute inset-0 bg-accent/20 pointer-events-none"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />

      {/* Card */}
      <motion.div
        className="relative rounded-3xl border border-accent/50 bg-surface px-12 py-10 text-center shadow-2xl"
        style={{ boxShadow: '0 0 60px 8px rgba(124,58,237,0.25)' }}
        initial={{ scale: 0.75, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.p
          className="text-[11px] font-bold tracking-[0.25em] text-accent-light uppercase mb-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          Level Up
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 18 }}
        >
          <CountUp
            start={previousLevel}
            end={newLevel}
            duration={0.7}
            delay={0.25}
            className="text-8xl font-black text-white tabular-nums leading-none"
          />
        </motion.div>

        <motion.p
          className="text-sm text-muted mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          You've reached Level {newLevel}
        </motion.p>

        {/* Pulsing glow ring */}
        <motion.div
          className="absolute inset-0 rounded-3xl border border-accent/30 pointer-events-none"
          animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        />

        <p className="text-[10px] text-muted/50 mt-5">Tap to dismiss</p>
      </motion.div>
    </div>
  );
}
