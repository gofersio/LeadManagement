"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", filled: true },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "auto_awesome" },
  { href: "/dashboard/prospects", label: "Leads", icon: "group" },
  { href: "/dashboard/inbox", label: "Unified Inbox", icon: "mail" },
  { href: "/dashboard/mailboxes", label: "Mailboxes", icon: "alternate_email" },
];

interface SidebarProps {
  userName?: string;
  userRole?: string;
}

export function Sidebar({ userName = "User", userRole = "Sales" }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-surface border-r border-outline-variant flex flex-col py-8 px-4 z-50">
      <div className="mb-12 px-2">
        <h1 className="text-headline-md font-bold text-on-surface">Gofer Outreach</h1>
        <p className="text-body-sm text-on-surface-variant opacity-70">B2B Growth</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-2 rounded transition-colors",
                active
                  ? "bg-secondary-container text-on-secondary-container font-bold"
                  : "text-secondary hover:bg-surface-container-high",
              )}
            >
              <Icon name={item.icon} filled={active && item.filled} />
              <span className="text-body-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-outline-variant pt-6">
        <Link
          href="/dashboard/campaigns/new"
          className="w-full bg-primary text-on-primary font-bold py-4 px-4 rounded flex items-center justify-center gap-2 mb-6 transition-colors hover:bg-primary-container"
        >
          <Icon name="add" />
          <span>New Campaign</span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-4 px-4 py-2 rounded text-secondary hover:bg-surface-container-high transition-colors"
        >
          <Icon name="settings" />
          <span className="text-body-md">Settings</span>
        </Link>
        <a
          href="#"
          className="flex items-center gap-4 px-4 py-2 rounded text-secondary hover:bg-surface-container-high transition-colors"
        >
          <Icon name="help" />
          <span className="text-body-md">Support</span>
        </a>
        <div className="flex items-center gap-4 px-4 py-4 mt-2">
          <div className="w-10 h-10 rounded-full border border-outline-variant bg-primary-fixed flex items-center justify-center">
            <Icon name="person" className="text-primary" filled />
          </div>
          <div className="overflow-hidden">
            <p className="text-label-md truncate">{userName}</p>
            <p className="text-[10px] text-on-surface-variant truncate">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
