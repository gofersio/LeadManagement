import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  trend?: { direction: "up" | "down"; text: string };
  className?: string;
}

export function MetricCard({ label, value, icon, trend, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-surface-container-lowest border border-outline-variant p-6 rounded hover:shadow-sm transition-shadow",
        className,
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-tertiary-container text-label-md uppercase">{label}</span>
        <Icon name={icon} className="text-primary" />
      </div>
      <p className="text-headline-md font-extrabold">{value}</p>
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2",
            trend.direction === "up" ? "text-primary" : "text-error",
          )}
        >
          <Icon
            name={trend.direction === "up" ? "trending_up" : "trending_down"}
            size={16}
          />
          <span className="text-label-sm">{trend.text}</span>
        </div>
      )}
    </div>
  );
}
