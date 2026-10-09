import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { importProspectsFromCsv } from "@/lib/prospects/import-csv";
import { parseProspectCsv } from "@/lib/prospects/parse-csv";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 5000;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const source = (formData.get("source") as string | null)?.trim() || "csv";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only .csv files are supported" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be 2 MB or smaller" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseProspectCsv(text);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "No valid rows found in CSV",
        parseErrors: parsed.errors,
      },
      { status: 400 },
    );
  }

  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `CSV exceeds maximum of ${MAX_ROWS} rows` },
      { status: 400 },
    );
  }

  const result = await importProspectsFromCsv(user.profile.id, parsed.rows, source);

  return NextResponse.json({
    ...result,
    totalRows: parsed.rows.length,
    parseErrors: parsed.errors,
  });
}
