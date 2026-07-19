'use client';

import { Rank } from '@/lib/api';

interface RankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'md' | 'lg';
}

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-rank-e border-rank-e/40 bg-rank-e/10',
  D: 'text-rank-d border-rank-d/40 bg-rank-d/10',
  C: 'text-rank-c border-rank-c/40 bg-rank-c/10',
  B: 'text-rank-b border-rank-b/40 bg-rank-b/10',
  A: 'text-rank-a border-rank-a/40 bg-rank-a/10',
  S: 'text-rank-s border-rank-s/40 bg-rank-s/10',
};

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs     px-2   py-1',
  lg: 'text-sm     px-3   py-1.5 font-bold',
};

export default function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-semibold tracking-wider ${RANK_STYLES[rank]} ${SIZE_CLASSES[size]}`}
    >
      {rank}
    </span>
  );
}
