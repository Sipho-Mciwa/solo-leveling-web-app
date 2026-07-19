'use client';

import { motion } from 'framer-motion';
import { Rank, RankProgress } from '@/lib/api';

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-rank-e',
  D: 'text-rank-d',
  C: 'text-rank-c',
  B: 'text-rank-b',
  A: 'text-rank-a',
  S: 'text-rank-s',
};

interface RankProgressBarProps {
  rank: Rank;
  rankProgress: RankProgress | null;
  variant: 'full' | 'compact';
}

export default function RankProgressBar({ rank, rankProgress, variant }: RankProgressBarProps) {
  const rankMetCount   = rankProgress?.metCount   ?? 0;
  const rankTotalCount = rankProgress?.totalCount ?? 0;
  const rankNextRank   = rankProgress?.nextRank   ?? null;
  const rankPct        = rankTotalCount > 0 ? (rankMetCount / rankTotalCount) * 100 : 100;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold ${RANK_STYLES[rank ?? 'E']}`}>{rank}</span>
        <div className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${rankPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            style={{
              background:
                rankNextRank == null
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            }}
          />
        </div>
        {rankNextRank && (
          <span className={`text-[11px] font-bold ${RANK_STYLES[rankNextRank]}`}>
            {rankNextRank}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted mt-1 text-right">
        {rankNextRank == null
          ? 'Max rank achieved'
          : rankProgress
          ? `${rankMetCount}/${rankTotalCount} conditions met for ${rankNextRank}-Rank`
          : `Working towards ${rankNextRank}-Rank`}
      </p>
      {variant === 'full' && rankProgress && rankNextRank && rankProgress.criteria.length > 0 && (
        <div className="mt-2 space-y-1">
          {rankProgress.criteria.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-[10px]">
              <span className={c.met ? 'text-success' : 'text-muted'}>
                {c.met ? '✓' : '·'} {c.label}
              </span>
              <span className={`tabular-nums ${c.met ? 'text-success' : 'text-muted'}`}>
                {c.current}/{c.target}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
