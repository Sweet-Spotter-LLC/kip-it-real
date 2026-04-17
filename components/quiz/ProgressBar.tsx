/**
 * Quiz progress bar.
 * Shows "Step N of M" text + a gold-accented fill against an oxblood track.
 */
interface ProgressBarProps {
  current: number; // 1-indexed for display
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-[0.18em]">
        <span className="text-brand-primary">
          Step {current} of {total}
        </span>
        <span className="text-brand-support">{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-bg-deep"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent
                     transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
