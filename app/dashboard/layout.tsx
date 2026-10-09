import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const unreadNotifications = await prisma.appNotification.count({
    where: { userId: user.profile.id, readAt: null },
  });

  return (
    <DashboardShell
      userName={user.profile.fullName ?? user.email}
      userRole="Sales"
      notificationCount={unreadNotifications}
    >
      {children}
    </DashboardShell>
  );
}
