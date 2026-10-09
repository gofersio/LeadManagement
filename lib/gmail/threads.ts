import { getAuthenticatedGmailClient } from "@/lib/gmail/client";

interface ThreadMessage {
  id: string;
  from: string;
  snippet: string;
  messageIdHeader: string | null;
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
): string | null {
  const found = headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

export async function getThreadMessages(
  mailboxId: string,
  threadId: string,
): Promise<ThreadMessage[]> {
  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "Message-ID", "Subject"],
  });

  return (thread.data.messages ?? []).map((msg) => ({
    id: msg.id!,
    from: getHeader(msg.payload?.headers, "From") ?? "",
    snippet: msg.snippet ?? "",
    messageIdHeader: getHeader(msg.payload?.headers, "Message-ID"),
  }));
}

export async function findReplyFromProspect(
  mailboxId: string,
  mailboxEmail: string,
  threadId: string | null,
  prospectEmail: string,
): Promise<{ messageId: string; threadId: string; snippet: string } | null> {
  const normalizedProspect = prospectEmail.toLowerCase();
  const normalizedMailbox = mailboxEmail.toLowerCase();

  if (threadId) {
    const messages = await getThreadMessages(mailboxId, threadId);
    for (const msg of messages) {
      const fromLower = msg.from.toLowerCase();
      if (
        fromLower.includes(normalizedProspect) &&
        !fromLower.includes(normalizedMailbox)
      ) {
        return {
          messageId: msg.id,
          threadId,
          snippet: msg.snippet,
        };
      }
    }
  }

  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  const search = await gmail.users.messages.list({
    userId: "me",
    q: `from:${prospectEmail} newer_than:7d`,
    maxResults: 5,
  });

  for (const msg of search.data.messages ?? []) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From"],
    });
    const from = getHeader(full.data.payload?.headers, "From") ?? "";
    if (from.toLowerCase().includes(normalizedProspect)) {
      return {
        messageId: msg.id!,
        threadId: full.data.threadId ?? threadId ?? "",
        snippet: full.data.snippet ?? "",
      };
    }
  }

  return null;
}

export async function getLastOutboundMessageId(
  mailboxId: string,
  threadId: string,
  mailboxEmail: string,
): Promise<{ messageIdHeader: string | null; subject: string | null }> {
  const messages = await getThreadMessages(mailboxId, threadId);
  const outbound = [...messages]
    .reverse()
    .find((m) => m.from.toLowerCase().includes(mailboxEmail.toLowerCase()));

  if (!outbound) return { messageIdHeader: null, subject: null };

  const { gmail } = await getAuthenticatedGmailClient(mailboxId);
  const full = await gmail.users.messages.get({
    userId: "me",
    id: outbound.id,
    format: "metadata",
    metadataHeaders: ["Message-ID", "Subject"],
  });

  return {
    messageIdHeader: getHeader(full.data.payload?.headers, "Message-ID"),
    subject: getHeader(full.data.payload?.headers, "Subject"),
  };
}
