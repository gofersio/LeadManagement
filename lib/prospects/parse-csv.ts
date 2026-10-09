export type ProspectCsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  title?: string;
  linkedInUrl?: string;
};

export type CsvParseResult = {
  headers: string[];
  rows: ProspectCsvRow[];
  errors: { row: number; message: string }[];
};

const FIELD_ALIASES: Record<string, keyof ProspectCsvRow | "name"> = {
  first_name: "firstName",
  firstname: "firstName",
  "first name": "firstName",
  fname: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  "last name": "lastName",
  lname: "lastName",
  name: "name",
  email: "email",
  email_address: "email",
  "email address": "email",
  company: "company",
  organization: "company",
  org: "company",
  title: "title",
  job_title: "title",
  "job title": "title",
  position: "title",
  linkedin: "linkedInUrl",
  linkedin_url: "linkedInUrl",
  "linkedin url": "linkedInUrl",
  linkedinurl: "linkedInUrl",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(current.trim());
      current = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "Lead" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapRow(
  headers: string[],
  values: string[],
  rowNumber: number,
): { row?: ProspectCsvRow; error?: string } {
  const mapped: Partial<Record<keyof ProspectCsvRow | "name", string>> = {};

  headers.forEach((header, index) => {
    const field = FIELD_ALIASES[normalizeHeader(header)];
    const value = values[index]?.trim() ?? "";
    if (!field || !value) return;
    mapped[field] = value;
  });

  let firstName = mapped.firstName;
  let lastName = mapped.lastName;

  if ((!firstName || !lastName) && mapped.name) {
    const split = splitName(mapped.name);
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }

  const email = mapped.email?.toLowerCase();
  if (!email) return { error: `Row ${rowNumber}: missing email` };
  if (!isValidEmail(email)) return { error: `Row ${rowNumber}: invalid email "${email}"` };

  if (!firstName || !lastName) {
    const fromEmail = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    const split = splitName(fromEmail || "Unknown Lead");
    firstName = firstName || split.firstName;
    lastName = lastName || split.lastName;
  }

  return {
    row: {
      firstName,
      lastName,
      email,
      company: mapped.company || undefined,
      title: mapped.title || undefined,
      linkedInUrl: mapped.linkedInUrl || undefined,
    },
  };
}

export function parseProspectCsv(text: string): CsvParseResult {
  const raw = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (raw.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: "CSV file is empty" }] };
  }

  const headers = raw[0];
  const rows: ProspectCsvRow[] = [];
  const errors: { row: number; message: string }[] = [];

  if (!headers.some((h) => FIELD_ALIASES[normalizeHeader(h)] === "email")) {
    return {
      headers,
      rows: [],
      errors: [{ row: 1, message: "CSV must include an email column" }],
    };
  }

  for (let i = 1; i < raw.length; i++) {
    const result = mapRow(headers, raw[i], i + 1);
    if (result.row) rows.push(result.row);
    else if (result.error) errors.push({ row: i + 1, message: result.error });
  }

  return { headers, rows, errors };
}

export const CSV_TEMPLATE = `first_name,last_name,email,company,title,linkedin_url
Jane,Doe,jane@example.com,Acme Inc,CEO,https://linkedin.com/in/janedoe
John,Smith,john@example.com,Globex,VP Sales,
`;
