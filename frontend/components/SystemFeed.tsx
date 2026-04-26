'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSystemEvents, markSystemEventsSeen, SystemEvent, SystemEventType } from '@/lib/api';
import { eventTypeToTone, TONE_STYLES, GLOW_DURATION, SHAKE_X } from '@/utils/systemStyles';

// ─── Visual config by event type ─────────────────────────────────────────────

const TYPE_CONFIG: Record<SystemEventType, {
  border: string;
  tagBg: string;
  tagText: string;
  dot: string;
}> = {
  system:    { border: 'border-accent/50',   tagBg: 'bg-accent/15',       tagText: 'text-accent-light',  dot: 'bg-accent' },
  warning:   { border: 'border-amber-400/60', tagBg: 'bg-amber-400/10',    tagText: 'text-amber-400',     dot: 'bg-amber-400' },
  alert:     { border: 'border-red-400/60',   tagBg: 'bg-red-400/10',      tagText: 'text-red-400',       dot: 'bg-red-400' },
  narrative: { border: 'border-sky-400/50',   tagBg: 'bg-sky-400/10',      tagText: 'text-sky-400',       dot: 'bg-sky-400' },
  special:   { border: 'border-yellow-400/60',tagBg: 'bg-yellow-400/10',   tagText: 'text-yellow-300',    dot: 'bg-yellow-400' },
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function EventIcon({ icon, type }: { icon: SystemEvent['icon']; type: SystemEventType }) {
  const color = {
    system:    'text-accent-light',
    warning:   'text-amber-400',
    alert:     'text-red-400',
    narrative: 'text-sky-400',
    special:   'text-yellow-300',
  }[type];

  const glyphs: Record<SystemEvent['icon'], string> = {
    system:  '◆',
    warning: '⚠',
    trophy:  '★',
    boss:    '☠',
    star:    '✦',
    xp:      '⚡',
  };

  return (
    <span className={`text-sm leading-none shrink-0 ${color}`} aria-hidden>
      {glyphs[icon] ?? '◆'}
    </span>
  );
}

// ─── Relative timestamp ───────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (mins < 1)   return 'now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Single Event Row ─────────────────────────────────────────────────────────

function EventRow({ event, index }: { event: SystemEvent; index: number }) {
  const cfg       = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.system;
  const tone      = eventTypeToTone(event.type);
  const s         = TONE_STYLES[tone];
  const hasGlow   = tone !== 'info';
  const glowDelay = index * 0.06;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{
        opacity: 1,
        x: tone === 'critical' ? SHAKE_X.critical! : 0,
        ...(hasGlow && { boxShadow: [s.glowOff, s.glowOn, s.glowOff] }),
      }}
      transition={{
        opacity:   { duration: 0.28, ease: 'easeOut', delay: glowDelay },
        x:         tone === 'critical'
          ? { duration: 0.45, ease: 'easeInOut', delay: glowDelay + 0.1 }
          : { duration: 0 },
        boxShadow: hasGlow
          ? { duration: GLOW_DURATION[tone], repeat: Infinity, ease: 'easeInOut', delay: glowDelay }
          : {},
      }}
      className={`relative pl-4 pr-4 py-3.5 border-l-2 ${cfg.border} ${
        !event.seen ? 'bg-white/[0.02]' : ''
      }`}
    >
      {/* Unseen pulse dot */}
      {!event.seen && (
        <motion.span
          className={`absolute right-3 top-3.5 w-1.5 h-1.5 rounded-full ${cfg.dot}`}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}

      <div className="flex items-start gap-2.5">
        <EventIcon icon={event.icon} type={event.type} />

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[11px] font-bold tracking-wider text-white uppercase leading-none">
              {event.title}
            </span>
            {event.tag && (
              <span className={`text-[9px] font-bold tracking-widest uppercase rounded px-1.5 py-0.5 leading-none ${cfg.tagBg} ${cfg.tagText}`}>
                {event.tag}
              </span>
            )}
          </div>

          {/* Message */}
          <p className="text-[11px] text-muted/80 leading-snug mt-0.5 pr-4">
            {event.message}
          </p>

          {/* Timestamp */}
          <p className="text-[9px] text-muted/40 mt-1.5 uppercase tracking-widest">
            {relativeTime(event.timestamp)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-px animate-pulse">
      {[48, 56, 44].map((h, i) => (
        <div key={i} className={`h-[${h}px] bg-surface/60 border-l-2 border-subtle pl-4 py-3`}>
          <div className="h-2.5 w-32 bg-subtle/60 rounded mb-2" />
          <div className="h-2 w-48 bg-subtle/40 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemFeed() {
  const [events,     setEvents]     = useState<SystemEvent[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(true);
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchSystemEvents();
      setEvents(data.events);
      setUnseenCount(data.unseenCount);
      setLastFetch(new Date());
    } catch {
      // Silent — feed is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 15-minute auto-refresh
  useEffect(() => {
    load();
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // Mark as seen when user expands the panel
  useEffect(() => {
    if (expanded && unseenCount > 0) {
      markSystemEventsSeen()
        .then(() => {
          setUnseenCount(0);
          setEvents((prev) => prev.map((e) => ({ ...e, seen: true })));
        })
        .catch(() => {});
    }
  }, [expanded, unseenCount]);

  if (!loading && events.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
      className="rounded-2xl border border-border bg-surface overflow-hidden mt-4"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] tracking-[0.35em] uppercase text-muted font-medium">System</span>
          <span className="text-[9px] tracking-[0.35em] uppercase text-accent-light/70 font-medium">Log</span>
          {unseenCount > 0 && (
            <motion.span
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              className="text-[9px] font-bold bg-accent/20 text-accent-light rounded-full px-1.5 py-0.5 leading-none"
            >
              {unseenCount} new
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastFetch && !loading && (
            <span className="text-[9px] text-muted/40 uppercase tracking-widest hidden sm:block">
              {relativeTime(lastFetch.toISOString())}
            </span>
          )}
          <motion.svg
            className="w-3.5 h-3.5 text-muted/50"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            animate={{ rotate: expanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="feed"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border"
          >
            {loading ? (
              <div className="p-0">
                <FeedSkeleton />
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {events.map((event, i) => (
                  <EventRow key={event.id} event={event} index={i} />
                ))}
              </div>
            )}

            {/* Footer */}
            {!loading && events.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between">
                <span className="text-[9px] text-muted/40 uppercase tracking-widest">
                  {events.length} active signal{events.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); load(); }}
                  className="text-[9px] text-muted/50 uppercase tracking-widest hover:text-muted transition-colors"
                >
                  Refresh
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
