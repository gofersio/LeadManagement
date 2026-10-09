import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("w-full max-w-[120px]", className)}>
      <p className="text-label-md">
        {value.toLocaleString()} / {max.toLocaleString()}
      </p>
      <div className="w-full h-1 bg-surface-container mt-1">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
