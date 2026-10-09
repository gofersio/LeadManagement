import { startOfDay } from "date-fns";
import { headers } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { checkMailboxScopesFromStored } from "@/lib/gmail/verify-scopes";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { ConnectGmailLink } from "@/components/mailboxes/connect-gmail-link";
import { GoogleOAuthHelp, MailboxAlerts } from "@/components/mailboxes/google-oauth-help";
import { MailboxesClient } from "@/components/mailboxes/mailboxes-client";

export default async function MailboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const params = await searchParams;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const gmailRedirectUri = `${protocol}://${host}/api/auth/google/callback`;
  const today = startOfDay(new Date());

  const mailboxes = await prisma.gmailMailbox.findMany({
    where: { userId: user.profile.id },
    orderBy: { createdAt: "desc" },
  });

  const mailboxIds = mailboxes.map((mb) => mb.id);

  const sentTodayByMailbox =
    mailboxIds.length === 0
      ? []
      : await prisma.emailMessage.groupBy({
          by: ["mailboxId"],
          where: {
            mailboxId: { in: mailboxIds },
            status: "sent",
            sentAt: { gte: today },
          },
          _count: { _all: true },
        });

  const sentMap = new Map(
    sentTodayByMailbox.map((r) => [r.mailboxId, r._count._all]),
  );

  const mailboxesWithStats = mailboxes.map((mb) => {
    const scopeCheck = checkMailboxScopesFromStored(mb.tokenScope);
    return {
      id: mb.id,
      email: mb.email,
      dailySendLimit: mb.dailySendLimit,
      isActive: mb.isActive,
      sentToday: sentMap.get(mb.id) ?? 0,
      hasGmailSendScope: scopeCheck.ok,
      missingScopes: scopeCheck.missing,
    };
  });

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="Mailboxes"
        subtitle="Connect your Google Workspace Gmail account"
        actions={<ConnectGmailLink showIcon />}
      />

      <GoogleOAuthHelp redirectUri={gmailRedirectUri} />

      <MailboxAlerts connected={params.connected} error={params.error} />

      <MailboxesClient mailboxes={mailboxesWithStats} />
    </div>
  );
}
