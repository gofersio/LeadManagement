import { getAuthenticatedGmailClient } from "@/lib/gmail/client";
import { verifyMailboxScopes } from "@/lib/gmail/verify-scopes";

interface SendEmailParams {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyToMessageId?: string | null;
  references?: string | null;
}

function encodeMessage(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

import { isHtmlBody } from "@/lib/email/html-body";

function buildRawMime(params: SendEmailParams, fromEmail: string): string {
  const lines: string[] = [];
  lines.push(`From: ${fromEmail}`);
  lines.push(`To: ${params.to}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.inReplyToMessageId) {
    lines.push(`In-Reply-To: ${params.inReplyToMessageId}`);
    lines.push(`References: ${params.references ?? params.inReplyToMessageId}`);
  }
  const contentType = isHtmlBody(params.body) ? "text/html" : "text/plain";
  lines.push(`Content-Type: ${contentType}; charset="UTF-8"`);
  lines.push("MIME-Version: 1.0");
  lines.push("");
  lines.push(params.body);
  return lines.join("\r\n");
}

export async function sendGmailMessage(params: SendEmailParams) {
  const scopeCheck = await verifyMailboxScopes(params.mailboxId);
  if (!scopeCheck.ok) {
    throw new Error(
      `Gmail not authorized for sending. Missing scopes: ${scopeCheck.missing.join(", ")}. ` +
        "Go to Mailboxes → Reconnect Gmail and approve all Gmail permissions (Advanced → Continue).",
    );
  }

  const { gmail, mailbox } = await getAuthenticatedGmailClient(params.mailboxId);
  const raw = buildRawMime(params, mailbox.email);
  const encoded = encodeMessage(raw);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encoded,
      threadId: params.threadId ?? undefined,
    },
  });

  return {
    messageId: response.data.id!,
    threadId: response.data.threadId ?? params.threadId ?? null,
  };
}
