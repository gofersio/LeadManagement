export interface ProspectFields {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
}

const MERGE_TAG_PATTERN =
  /\{\{(first_name|last_name|full_name|company|title|email)\}\}/gi;

const UNSUBSCRIBE_FOOTER =
  "\n\n---\nIf you no longer wish to receive emails, reply with UNSUBSCRIBE.";

function mergeFieldValue(prospect: ProspectFields, key: string): string {
  switch (key) {
    case "first_name":
      return prospect.firstName?.trim() ?? "";
    case "last_name":
      return prospect.lastName?.trim() ?? "";
    case "full_name": {
      const parts = [prospect.firstName, prospect.lastName]
        .map((p) => p?.trim())
        .filter(Boolean);
      return parts.join(" ");
    }
    case "company":
      return prospect.company?.trim() ?? "";
    case "title":
      return prospect.title?.trim() ?? "";
    case "email":
      return prospect.email?.trim() ?? "";
    default:
      return "";
  }
}

function replaceTags(text: string, prospect: ProspectFields): string {
  return text.replace(MERGE_TAG_PATTERN, (_, tag: string) =>
    mergeFieldValue(prospect, tag.toLowerCase()),
  );
}

export function renderSubject(subject: string, prospect: ProspectFields): string {
  return replaceTags(subject, prospect);
}

export function renderTemplate(body: string, prospect: ProspectFields): string {
  const rendered = replaceTags(body, prospect);
  if (rendered.includes("UNSUBSCRIBE")) return rendered;
  return rendered + UNSUBSCRIBE_FOOTER;
}

export function containsUnsubscribe(text: string): boolean {
  return /\bunsubscribe\b/i.test(text);
}
