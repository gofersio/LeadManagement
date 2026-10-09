/** True when body content looks like HTML from the rich text editor. */
export function isHtmlBody(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}

/** Convert stored HTML (or plain text) to readable plain text for previews. */
export function htmlToPlainText(body: string): string {
  if (!body) return "";
  if (!isHtmlBody(body)) return body;

  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text from the editor → HTML paragraphs for Tiptap. */
export function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  if (isHtmlBody(text)) return text;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return lines.map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`).join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
