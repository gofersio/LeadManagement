import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuppressionForm } from "@/components/settings/suppression-form";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const mailboxes = await prisma.gmailMailbox.findMany({
    where: { userId: user.profile.id },
    select: { email: true, isActive: true },
  });

  const suppressions = await prisma.suppressionList.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <PageHeader title="Settings" subtitle="Account and compliance settings" />

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-body-md">
            <p>
              <span className="text-on-surface-variant">Name:</span>{" "}
              {user.profile.fullName ?? "—"}
            </p>
            <p>
              <span className="text-on-surface-variant">Email:</span> {user.profile.email}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected Mailboxes</CardTitle>
          </CardHeader>
          <CardContent>
            {mailboxes.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">No mailboxes connected.</p>
            ) : (
              <ul className="space-y-2">
                {mailboxes.map((mb) => (
                  <li key={mb.email} className="text-body-md">
                    {mb.email} — {mb.isActive ? "Active" : "Inactive"}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suppression List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SuppressionForm />
            {suppressions.length > 0 && (
              <ul className="space-y-1 text-body-sm">
                {suppressions.map((s) => (
                  <li key={s.id} className="text-on-surface-variant">
                    {s.email} {s.reason ? `(${s.reason})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
