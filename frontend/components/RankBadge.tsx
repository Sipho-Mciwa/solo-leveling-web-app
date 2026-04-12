'use client';

import { Rank } from '@/lib/api';

interface RankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'md' | 'lg';
}

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-gray-400   border-gray-400/40   bg-gray-400/10',
  D: 'text-green-400  border-green-400/40  bg-green-400/10',
  C: 'text-blue-400   border-blue-400/40   bg-blue-400/10',
  B: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
  A: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
  S: 'text-red-400    border-red-400/40    bg-red-400/10',
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
