"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface HeaderTab {
  label: string;
  href: string;
  active?: boolean;
}

interface DashboardHeaderProps {
  searchPlaceholder?: string;
  tabs?: HeaderTab[];
  notificationCount?: number;
}

export function DashboardHeader({
  searchPlaceholder = "Search...",
  tabs,
  notificationCount = 0,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-surface-bright border-b border-outline-variant flex justify-between items-center px-8">
      <div className="flex items-center gap-8">
        <div className="relative group">
          <Icon
            name="search"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant"
            size={20}
          />
          <input
            className="pl-8 pr-4 py-1 bg-surface-container-low border border-outline-variant rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 text-body-md transition-all"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
        {tabs && tabs.length > 0 && (
          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "text-label-md pb-1 transition-colors",
                  tab.active
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inbox"
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant relative"
        >
          <Icon name="notifications" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-on-primary text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>
        <button
          type="button"
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant"
        >
          <Icon name="history" />
        </button>
        <div className="h-6 w-px bg-outline-variant mx-1" />
        <Link
          href="/dashboard/settings"
          className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant"
        >
          <Icon name="account_circle" />
        </Link>
      </div>
    </header>
  );
}
