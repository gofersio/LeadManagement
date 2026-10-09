"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  analyzeEmailContent,
  COLD_EMAIL_TIPS,
  progressBarColor,
  statusColor,
} from "@/lib/email/content-guide";
import { cn } from "@/lib/utils";

interface ContentGuidePanelProps {
  subject: string;
  body: string;
  onInsertSpintax?: () => void;
  onOpenMergeTags?: () => void;
}

export function ContentGuidePanel({
  subject,
  body,
  onInsertSpintax,
  onOpenMergeTags,
}: ContentGuidePanelProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const analysis = useMemo(() => analyzeEmailContent(subject, body), [subject, body]);
  const tip = COLD_EMAIL_TIPS[tipIndex];

  function prevTip() {
    setTipIndex((i) => (i === 0 ? COLD_EMAIL_TIPS.length - 1 : i - 1));
  }

  function nextTip() {
    setTipIndex((i) => (i === COLD_EMAIL_TIPS.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-tertiary text-on-tertiary-container">
              New
            </span>
          </div>
          <p className="text-[13px] font-semibold text-on-surface leading-snug mb-1">
            {tip.title}
          </p>
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            {tip.body}{" "}
            <button
              type="button"
              onClick={tipIndex === 0 ? onInsertSpintax : undefined}
              className="text-primary hover:underline font-medium"
            >
              {tip.linkLabel}
            </button>
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
            <span className="text-[12px] font-medium text-primary">
              Cold Email Tips {tipIndex + 1}/{COLD_EMAIL_TIPS.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevTip}
                className="p-1 rounded hover:bg-primary/10 text-on-surface-variant"
                aria-label="Previous tip"
              >
                <Icon name="chevron_left" size={18} />
              </button>
              <button
                type="button"
                onClick={nextTip}
                className="p-1 rounded hover:bg-primary/10 text-on-surface-variant"
                aria-label="Next tip"
              >
                <Icon name="chevron_right" size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {analysis.metrics.map((metric) => (
            <div key={metric.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-on-surface">{metric.label}</p>
                <p className="text-[12px] text-on-surface-variant shrink-0">{metric.value}</p>
              </div>
              <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", progressBarColor(metric.statusKind))}
                  style={{ width: `${metric.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-on-surface-variant">{metric.suggestion}</p>
                <p className={cn("text-[11px] font-semibold shrink-0", statusColor(metric.statusKind))}>
                  {metric.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
        <button
          type="button"
          onClick={onOpenMergeTags}
          className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
        >
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-tertiary text-on-tertiary-container shrink-0">
            New
          </span>
          <span className="text-[12px] font-semibold text-on-surface leading-snug">
            Hyper-personalize your emails with Variable Tags
          </span>
        </button>
      </div>
    </div>
  );
}
