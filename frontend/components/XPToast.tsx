'use client';

import { motion } from 'framer-motion';

interface XPToastProps {
  xp: number;
  onDone: () => void;
}

export default function XPToast({ xp, onDone }: XPToastProps) {
  return (
    <motion.div
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none"
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -72, scale: 1.1 }}
      transition={{ duration: 1.6, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      <div className="flex items-center gap-2 bg-accent/20 border border-accent/50 rounded-full px-5 py-2.5 shadow-lg shadow-accent/20">
        <span className="text-accent-light font-black text-base tracking-wide">+{xp} XP</span>
      </div>
    </motion.div>
  );
}
