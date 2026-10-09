import { getAuthenticatedGmailClient } from "@/lib/gmail/client";
import {
  decodeBase64UrlToBuffer,
  extractBody,
  formatMessageDate,
  getHeader,
  parseAddressList,
  parseFromHeader,
  resolveCidImagesInHtml,
} from "@/lib/gmail/parse-message";
import { prisma } from "@/lib/prisma";

export type InboxThreadSummary = {
  threadId: string;
  mailboxId: string;
  mailboxEmail: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messageCount: number;
  direction?: "sent" | "received" | "mixed";
  toName?: string;
  toEmail?: string;
};

export type InboxMessage = {
  id: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  messageIdHeader: string | null;
  isOutbound: boolean;
  source?: "gmail" | "campaign" | "reply";
  gmailMessageId?: string | null;
};

export type InboxThreadDetail = {
  threadId: string;
  mailboxId: string;
  mailboxEmail: string;
  subject: string;
  messages: InboxMessage[];
};

export type InboxScheduledItem = {
  id: string;
  mailboxId: string;
  scheduledFor: string;
  prospectName: string;
  prospectEmail: string;
  campaignName: string;
  campaignId: string;
  stepNumber: number;
  status: string;
  subject: string;
};

type ListOptions = {
  tab: "all" | "unread" | "sent" | "received" | "scheduled" | "draft";
  query?: string;
  maxResults?: number;
};

function buildSearchQuery(tab: ListOptions["tab"], query?: string): string {
  const parts: string[] = [];
  if (tab === "unread") parts.push("is:unread");
  if (query?.trim()) parts.push(query.trim());
  return parts.join(" ");
}

function threadDirection(
  messages: { labelIds?: string[] | null; payload?: { headers?: { name?: string | null; value?: string | null }[] | null } | null }[],
  mailboxEmail: string,
): "sent" | "received" | "mixed" {
  let hasSent = false;
  let hasReceived = false;
  for (const msg of messages) {
    if (msg.labelIds?.includes("SENT")) hasSent = true;
    const from = getHeader(msg.payload?.headers ?? undefined, "From") ?? "";
    const { email } = parseFromHeader(from);
    if (email.toLowerCase() === mailboxEmail.toLowerCase()) hasSent = true;
    else hasReceived = true;
  }
  if (hasSent && hasReceived) return "mixed";
  if (hasSent) return "sent";
  return "received";
}

function summarizeThread(
  mailboxId: string,
  mailboxEmail: string,
  thread: { id?: string | null; snippet?: string | null; messages?: { id?: string | null; snippet?: string | null; labelIds?: string[] | null; payload?: { headers?: { name?: string | null; value?: string | null }[] | null } | null; internalDate?: string | null }[] | null },
): InboxThreadSummary | null {
  if (!thread.id || !thread.messages?.length) return null;

  const messages = thread.messages;
  const latest = messages[messages.length - 1]!;
  const headers = latest.payload?.headers ?? undefined;
  const fromRaw = getHeader(headers, "From") ?? "";
  const { name, email } = parseFromHeader(fromRaw);
  const subject = getHeader(headers, "Subject") ?? "(No subject)";
  const dateHeader = getHeader(headers, "Date");
  const date = dateHeader
    ? formatMessageDate(dateHeader).toISOString()
    : latest.internalDate
      ? new Date(Number(latest.internalDate)).toISOString()
      : new Date().toISOString();

  const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));
  const direction = threadDirection(messages, mailboxEmail);
  const toRaw = getHeader(headers, "To") ?? "";
  const toParsed = parseFromHeader(toRaw.includes("<") ? toRaw : `<${toRaw}>`);

  return {
    threadId: thread.id,
    mailboxId,
    mailboxEmail,
    subject,
    fromName: name,
    fromEmail: email,
    snippet: latest.snippet ?? thread.snippet ?? "",
    date,
    isUnread,
    messageCount: messages.length,
    direction,
    toName: direction === "sent" ? toParsed.name : undefined,
    toEmail: direction === "sent" ? toParsed.email : undefined,
  };
}

export async function listMailboxThreads(
  mailboxId: string,
  mailboxEmail: string,
  options: ListOptions,
): Promise<InboxThreadSummary[]> {
  if (options.tab === "scheduled") return [];

  const { gmail } = await getAuthenticatedGmailClient(mailboxId);

  const labelIds =
    options.tab === "draft"
      ? ["DRAFT"]
      : options.tab === "sent"
        ? ["SENT"]
        : options.tab === "received"
          ? ["INBOX"]
          : undefined;

  const list = await gmail.users.threads.list({
    userId: "me",
    labelIds,
    maxResults: options.maxResults ?? 40,
    q: buildSearchQuery(options.tab, options.query) || undefined,
  });

  const threadIds = (list.data.threads ?? []).map((t) => t.id!).filter(Boolean);
  if (threadIds.length === 0) return [];

  const threads = await Promise.all(
    threadIds.map(async (threadId) => {
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date", "To"],
      });
      return summarizeThread(mailboxId, mailboxEmail, thread.data);
    }),
  );

  return threads.filter((t): t is InboxThreadSummary => t !== null);
}

export async function listAllMailboxThreads(
  mailboxId: string,
  mailboxEmail: string,
  options: Omit<ListOptions, "tab"> & { tab?: "all" },
): Promise<InboxThreadSummary[]> {
  const [inbox, sent] = await Promise.all([
    listMailboxThreads(mailboxId, mailboxEmail, { ...options, tab: "received" }),
    listMailboxThreads(mailboxId, mailboxEmail, { ...options, tab: "sent" }),
  ]);

  const byThread = new Map<string, InboxThreadSummary>();
  for (const t of [...inbox, ...sent]) {
    const existing = byThread.get(t.threadId);
    if (!existing || new Date(t.date) > new Date(existing.date)) {
      byThread.set(t.threadId, {
        ...t,
        direction:
          existing && existing.direction !== t.direction
            ? "mixed"
            : t.direction,
      });
    }
  }

  return [...byThread.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getThreadDetail(
  mailboxId: string,
  mailboxEmail: string,
  threadId: string,
): Promise<InboxThreadDetail> {
  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages: InboxMessage[] = (thread.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers;
    const fromRaw = getHeader(headers, "From") ?? "";
    const { name, email } = parseFromHeader(fromRaw);
    const to = parseAddressList(getHeader(headers, "To"));
    const cc = parseAddressList(getHeader(headers, "Cc"));
    const subject = getHeader(headers, "Subject") ?? "(No subject)";
    const dateHeader = getHeader(headers, "Date");
    const date = dateHeader
      ? formatMessageDate(dateHeader).toISOString()
      : msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString();
    const { html, text, inlineAttachments } = extractBody(msg.payload ?? undefined);
    const isOutbound = email.toLowerCase() === mailboxEmail.toLowerCase();
    let bodyHtml = html
      ? resolveCidImagesInHtml(html, inlineAttachments, mailboxId, msg.id!)
      : undefined;

    return {
      id: msg.id!,
      threadId,
      fromName: name,
      fromEmail: email,
      to,
      cc,
      subject,
      date,
      snippet: msg.snippet ?? "",
      bodyHtml,
      bodyText: text,
      messageIdHeader: getHeader(headers, "Message-ID"),
      isOutbound,
      source: "gmail" as const,
      gmailMessageId: msg.id,
    };
  });

  const subject = messages[0]?.subject ?? "(No subject)";

  return {
    threadId,
    mailboxId,
    mailboxEmail,
    subject,
    messages,
  };
}

export async function fetchGmailAttachment(
  mailboxId: string,
  messageId: string,
  attachmentId: string,
): Promise<{ data: Buffer; mimeType: string }> {
  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  let mimeType = "application/octet-stream";

  function findPart(
    part: { mimeType?: string | null; body?: { attachmentId?: string | null; data?: string | null } | null; parts?: unknown[] | null } | null | undefined,
  ): string | null {
    if (!part) return null;
    if (part.body?.attachmentId === attachmentId) {
      mimeType = part.mimeType ?? mimeType;
      return part.body.data ?? null;
    }
    for (const child of part.parts ?? []) {
      const found = findPart(child as typeof part);
      if (found) return found;
    }
    return null;
  }

  const inlineData = findPart(message.data.payload ?? undefined);
  if (inlineData) {
    return { data: decodeBase64UrlToBuffer(inlineData), mimeType };
  }

  const att = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const data = att.data.data ? decodeBase64UrlToBuffer(att.data.data) : Buffer.alloc(0);

  return { data, mimeType };
}

export async function markThreadAsRead(mailboxId: string, threadId: string) {
  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

export async function listScheduledSends(ownerUserId: string): Promise<InboxScheduledItem[]> {
  const items = await prisma.sendQueue.findMany({
    where: {
      status: { in: ["pending", "processing"] },
      enrollment: { campaign: { ownerUserId } },
    },
    include: {
      step: true,
      enrollment: {
        include: {
          prospect: true,
          campaign: true,
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: 50,
  });

  return items.map((item) => ({
    id: item.id,
    mailboxId: item.mailboxId,
    scheduledFor: item.scheduledFor.toISOString(),
    prospectName: `${item.enrollment.prospect.firstName} ${item.enrollment.prospect.lastName ?? ""}`.trim(),
    prospectEmail: item.enrollment.prospect.email,
    campaignName: item.enrollment.campaign.name,
    campaignId: item.enrollment.campaignId,
    stepNumber: item.step.stepNumber,
    status: item.status,
    subject: item.step.subject,
  }));
}

export async function listUserMailboxes(userId: string) {
  return prisma.gmailMailbox.findMany({
    where: { userId, isActive: true },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}
