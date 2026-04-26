'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'Initializing hunter profile...',
  'Loading daily quest board...',
  'Syncing rank progress...',
  'Calibrating stat attributes...',
  'Establishing shadow connection...',
  'Awakening hunter data...',
];

export default function LoadingScreen() {
  const [msgIdx,   setMsgIdx]   = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const msg = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, 900);

    const bar = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 14 + 3;
        return next >= 92 ? 92 : next;
      });
    }, 480);

    return () => {
      clearInterval(msg);
      clearInterval(bar);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center px-8"
    >
      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="mb-12 text-center"
      >
        <p className="text-[9px] tracking-[0.5em] uppercase text-muted mb-3">System</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Solo Leveling</h1>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="w-56 mb-4"
      >
        <div className="h-px bg-subtle rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted/50 tabular-nums">
            {Math.round(progress)}%
          </span>
          <span className="text-[9px] text-muted/50">loading</span>
        </div>
      </motion.div>

      {/* Cycling message */}
      <div className="h-4 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="text-[11px] text-muted/60 text-center"
          >
            {MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Pulsing dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-1 mt-10"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-accent/50"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
