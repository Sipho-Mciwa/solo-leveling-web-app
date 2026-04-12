interface StatItemProps {
  label: string;
  value: string | number;
}

export default function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="text-center py-1">
      <p className="text-lg font-bold text-white leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-muted mt-1.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
