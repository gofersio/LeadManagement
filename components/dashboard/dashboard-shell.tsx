import { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";

interface DashboardShellProps {
  children: ReactNode;
  userName?: string;
  userRole?: string;
  searchPlaceholder?: string;
  notificationCount?: number;
  tabs?: { label: string; href: string; active?: boolean }[];
}

export function DashboardShell({
  children,
  userName,
  userRole,
  searchPlaceholder,
  notificationCount,
  tabs,
}: DashboardShellProps) {
  return (
    <>
      <Sidebar userName={userName} userRole={userRole} />
      <main className="ml-[280px] min-h-screen">
        <DashboardHeader
          searchPlaceholder={searchPlaceholder}
          tabs={tabs}
          notificationCount={notificationCount}
        />
        {children}
      </main>
    </>
  );
}
