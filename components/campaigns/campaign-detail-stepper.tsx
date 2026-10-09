"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type CampaignDetailTabId = "steps" | "prospects" | "emails" | "settings";

export type CampaignDetailTab = {
  id: CampaignDetailTabId;
  label: string;
  count?: number;
  completed?: boolean;
};

interface CampaignDetailStepperProps {
  tabs: CampaignDetailTab[];
  activeTab: CampaignDetailTabId;
  onTabChange: (tab: CampaignDetailTabId) => void;
}

export function CampaignDetailStepper({
  tabs,
  activeTab,
  onTabChange,
}: CampaignDetailStepperProps) {
  return (
    <nav className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto">
      {tabs.map((t, index) => {
        const isActive = activeTab === t.id;
        return (
          <div key={t.id} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex items-center gap-2 px-1 py-3 border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              )}
            >
              <TabCircle active={isActive} completed={t.completed} />
              <span className={cn("text-[13px] whitespace-nowrap", isActive && "font-semibold")}>
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1 text-[11px] font-normal opacity-70">{t.count}</span>
                )}
              </span>
            </button>
            {index < tabs.length - 1 && (
              <Icon
                name="chevron_right"
                size={16}
                className="text-on-surface-variant/50 mx-1 shrink-0"
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center shrink-0 ml-1 opacity-40 pointer-events-none">
        <Icon name="chevron_right" size={16} className="text-on-surface-variant/50 mx-1" />
        <span className="flex items-center gap-2 px-1 py-3 text-[13px] text-on-surface-variant">
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-outline-variant">
            <Icon name="call_split" size={12} />
          </span>
          Subsequence
        </span>
      </div>
    </nav>
  );
}

function TabCircle({ active, completed }: { active: boolean; completed?: boolean }) {
  if (completed && !active) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
        <Icon name="check" size={11} className="text-white" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full border-2",
        active ? "border-primary bg-primary/10" : "border-outline-variant bg-transparent",
      )}
    />
  );
}
