'use client';

import { QuestHistoryRow } from '@/lib/api';
import TableCell from './TableCell';

interface DashboardTableProps {
  quests: QuestHistoryRow[];
  month: string; // "YYYY-MM"
}

export default function DashboardTable({ quests, month }: DashboardTableProps) {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const todayStr = new Date().toISOString().split('T')[0];
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  function dateStr(day: number) {
    return `${month}-${String(day).padStart(2, '0')}`;
  }

  function isToday(day: number) {
    return year === todayYear && monthNum === todayMonth && day === todayDay;
  }

  function isFuture(day: number) {
    return dateStr(day) > todayStr;
  }

  if (quests.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-16">
        No quest data for this month yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="border-separate border-spacing-0 min-w-full">
        <thead>
          <tr>
            {/* Top-left corner */}
            <th className="sticky left-0 z-30 bg-bg min-w-[140px] w-[140px] px-4 py-3 text-left border-b border-r border-border">
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Quest</span>
            </th>
            {/* Day number headers */}
            {days.map((day) => (
              <th
                key={day}
                className={`sticky top-0 z-20 bg-bg min-w-[40px] w-[40px] py-3 text-center border-b border-border ${
                  isToday(day) ? 'text-accent-light' : 'text-muted'
                }`}
              >
                <span className="text-xs font-medium">{day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quests.map((quest, rowIdx) => (
            <tr key={quest.questId}>
              {/* Quest name — sticky left */}
              <td
                className={`sticky left-0 z-10 bg-bg px-4 py-2 text-sm font-medium text-white border-r border-border whitespace-nowrap ${
                  rowIdx < quests.length - 1 ? 'border-b' : ''
                }`}
              >
                {quest.title}
              </td>
              {/* Day cells */}
              {days.map((day) => (
                <td
                  key={day}
                  className={`px-0.5 py-1 text-center ${rowIdx < quests.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <TableCell
                    entry={quest.history[dateStr(day)]}
                    isToday={isToday(day)}
                    isFuture={isFuture(day)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
