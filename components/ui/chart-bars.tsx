"use client";

import { useEffect } from "react";

interface ChartBarGroup {
  label: string;
  sent: number;
  replied: number;
  muted?: boolean;
}

interface ChartBarsProps {
  data: ChartBarGroup[];
}

export function ChartBars({ data }: ChartBarsProps) {
  const maxVal = Math.max(...data.flatMap((d) => [d.sent, d.replied]), 1);

  useEffect(() => {
    const bars = document.querySelectorAll(".chart-bar");
    bars.forEach((bar) => {
      const el = bar as HTMLElement;
      const height = el.style.height;
      el.style.height = "0";
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.style.height = height;
        }, 100);
      });
    });
  }, [data]);

  return (
    <div className="h-64 flex items-end justify-between gap-1 px-1 pb-6 border-b border-outline-variant relative">
      <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-t border-on-surface w-full" />
        ))}
      </div>
      {data.map((group) => (
        <div
          key={group.label}
          className={`flex-1 flex flex-col items-center gap-1 group ${group.muted ? "opacity-30" : ""}`}
        >
          <div className="w-full flex items-end justify-center gap-[2px] h-full">
            <div
              className="bg-primary w-2 chart-bar rounded-t-[1px] hover:brightness-110"
              style={{ height: `${(group.sent / maxVal) * 100}%` }}
            />
            <div
              className="bg-secondary-container w-2 chart-bar rounded-t-[1px] hover:brightness-110"
              style={{ height: `${(group.replied / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-label-sm text-on-surface-variant opacity-50">
            {group.label}
          </span>
        </div>
      ))}
    </div>
  );
}
