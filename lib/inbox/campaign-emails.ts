import { isHtmlBody, plainTextToHtml } from "@/lib/email/html-body";
import type { InboxMessage, InboxThreadSummary } from "@/lib/gmail/inbox";
import { parseFromHeader } from "@/lib/gmail/parse-message";
import { prisma } from "@/lib/prisma";

export async function loadLocalMessagesForThread(
  mailboxId: string,
  threadId: string,
  mailboxEmail: string,
  ownerUserId: string,
): Promise<InboxMessage[]> {
  const [sent, replies] = await Promise.all([
    prisma.emailMessage.findMany({
      where: {
        mailboxId,
        gmailThreadId: threadId,
        status: "sent",
        enrollment: { campaign: { ownerUserId } },
      },
      include: {
        enrollment: { include: { prospect: true } },
        step: true,
      },
      orderBy: { sentAt: "asc" },
    }),
    prisma.replyEvent.findMany({
      where: {
        mailboxId,
        gmailThreadId: threadId,
        enrollment: { campaign: { ownerUserId } },
      },
      include: {
        enrollment: { include: { prospect: true } },
      },
      orderBy: { detectedAt: "asc" },
    }),
  ]);

  const local: InboxMessage[] = [];

  for (const msg of sent) {
    const body = msg.bodyRendered;
    local.push({
      id: `local-sent-${msg.id}`,
      threadId,
      fromName: mailboxEmail.split("@")[0] ?? "You",
      fromEmail: mailboxEmail,
      to: [msg.toEmail],
      cc: [],
      subject: msg.subject,
      date: (msg.sentAt ?? msg.createdAt).toISOString(),
      snippet: body.replace(/<[^>]+>/g, "").slice(0, 120),
      bodyHtml: isHtmlBody(body) ? body : plainTextToHtml(body),
      bodyText: isHtmlBody(body) ? undefined : body,
      messageIdHeader: null,
      isOutbound: true,
      source: "campaign",
      gmailMessageId: msg.gmailMessageId,
    });
  }

  for (const reply of replies) {
    const prospect = reply.enrollment.prospect;
    const name = `${prospect.firstName} ${prospect.lastName ?? ""}`.trim();
    local.push({
      id: `local-reply-${reply.id}`,
      threadId,
      fromName: name,
      fromEmail: reply.fromEmail,
      to: [mailboxEmail],
      cc: [],
      subject: "Reply",
      date: reply.detectedAt.toISOString(),
      snippet: reply.snippet ?? "Reply received",
      bodyText: reply.snippet ?? "Reply received",
      messageIdHeader: null,
      isOutbound: false,
      source: "reply",
      gmailMessageId: reply.gmailMessageId,
    });
  }

  return local;
}

export function mergeThreadMessages(
  gmailMessages: InboxMessage[],
  localMessages: InboxMessage[],
): InboxMessage[] {
  const gmailIds = new Set(
    gmailMessages.map((m) => m.gmailMessageId).filter(Boolean) as string[],
  );

  const merged = [...gmailMessages];

  for (const local of localMessages) {
    if (local.gmailMessageId && gmailIds.has(local.gmailMessageId)) {
      const idx = merged.findIndex((m) => m.gmailMessageId === local.gmailMessageId);
      if (idx >= 0 && local.bodyHtml && !merged[idx].bodyHtml) {
        merged[idx] = {
          ...merged[idx],
          bodyHtml: local.bodyHtml,
          bodyText: local.bodyText,
          source: local.source,
        };
      }
      continue;
    }
    if (!local.gmailMessageId || !gmailIds.has(local.gmailMessageId)) {
      merged.push(local);
    }
  }

  return merged.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export async function listCampaignSentThreads(
  ownerUserId: string,
  mailboxId?: string,
): Promise<InboxThreadSummary[]> {
  const messages = await prisma.emailMessage.findMany({
    where: {
      status: "sent",
      gmailThreadId: { not: null },
      enrollment: { campaign: { ownerUserId } },
      ...(mailboxId ? { mailboxId } : {}),
    },
    include: {
      mailbox: true,
      enrollment: { include: { prospect: true, campaign: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  const byThread = new Map<string, (typeof messages)[0]>();
  for (const msg of messages) {
    const tid = msg.gmailThreadId!;
    if (!byThread.has(tid)) byThread.set(tid, msg);
  }

  return [...byThread.values()].map((msg) => {
    const prospect = msg.enrollment.prospect;
    const { name } = parseFromHeader(prospect.email);
    return {
      threadId: msg.gmailThreadId!,
      mailboxId: msg.mailboxId,
      mailboxEmail: msg.mailbox.email,
      subject: msg.subject,
      fromName: msg.mailbox.email.split("@")[0] ?? "You",
      fromEmail: msg.mailbox.email,
      snippet: msg.bodyRendered.replace(/<[^>]+>/g, "").slice(0, 140),
      date: (msg.sentAt ?? msg.createdAt).toISOString(),
      isUnread: false,
      messageCount: 1,
      direction: "sent" as const,
      toName: `${prospect.firstName} ${prospect.lastName ?? ""}`.trim() || name,
      toEmail: prospect.email,
    };
  });
}
