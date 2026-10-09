import type { gmail_v1 } from "googleapis";

export type InlineAttachment = {
  attachmentId: string;
  mimeType: string;
};

export type ExtractedBody = {
  html?: string;
  text?: string;
  inlineAttachments: Map<string, InlineAttachment>;
};

export function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
): string | null {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

export function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function decodeBase64UrlToBuffer(data: string): Buffer {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export function parseFromHeader(from: string): { name: string; email: string } {
  const angle = from.match(/<([^>]+)>/);
  const email = (angle?.[1] ?? from).trim();
  let name = from.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
  if (!name) name = email.split("@")[0] ?? email;
  return { name, email };
}

export function parseAddressList(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((part) => parseFromHeader(part.trim()).email);
}

function normalizeContentId(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/^<|>$/g, "").trim();
}

function walkMessagePart(
  part: gmail_v1.Schema$MessagePart,
  result: ExtractedBody,
): void {
  const mime = part.mimeType ?? "";
  const headers = part.headers ?? undefined;

  const contentId = normalizeContentId(getHeader(headers, "Content-ID"));
  if (contentId && part.body?.attachmentId) {
    result.inlineAttachments.set(contentId, {
      attachmentId: part.body.attachmentId,
      mimeType: mime || "application/octet-stream",
    });
  }

  if (part.body?.data) {
    const content = decodeBase64Url(part.body.data);
    if (mime === "text/html") {
      result.html = content;
    } else if (mime === "text/plain" && !result.text) {
      result.text = content;
    }
  }

  if (part.parts?.length) {
    if (mime === "multipart/alternative") {
      let altHtml: string | undefined;
      let altText: string | undefined;
      const nestedAttachments = new Map<string, InlineAttachment>();
      for (const child of part.parts) {
        const nested: ExtractedBody = {
          inlineAttachments: nestedAttachments,
        };
        walkMessagePart(child, nested);
        altHtml = altHtml ?? nested.html;
        altText = altText ?? nested.text;
        nested.inlineAttachments.forEach((v, k) => result.inlineAttachments.set(k, v));
      }
      result.html = result.html ?? altHtml;
      result.text = result.text ?? altText;
      return;
    }

    for (const child of part.parts) {
      walkMessagePart(child, result);
    }
  }
}

export function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): ExtractedBody {
  const result: ExtractedBody = { inlineAttachments: new Map() };
  if (!payload) return result;
  walkMessagePart(payload, result);
  return result;
}

/** Legacy helper */
export function extractBodySimple(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { html?: string; text?: string } {
  const { html, text } = extractBody(payload);
  return { html, text };
}

export function resolveCidImagesInHtml(
  html: string,
  inlineAttachments: Map<string, InlineAttachment>,
  mailboxId: string,
  messageId: string,
): string {
  if (!html || inlineAttachments.size === 0) return html;

  return html.replace(
    /src=(["'])cid:([^"']+)\1/gi,
    (_match, quote: string, cid: string) => {
      const att = inlineAttachments.get(cid);
      if (!att) return `src=${quote}cid:${cid}${quote}`;
      const url = `/api/inbox/attachments?mailboxId=${encodeURIComponent(mailboxId)}&messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(att.attachmentId)}`;
      return `src=${quote}${url}${quote}`;
    },
  );
}

export function formatMessageDate(raw: string | null): Date {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
