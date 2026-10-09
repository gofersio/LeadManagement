import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ProspectCsvRow } from "@/lib/prospects/parse-csv";

export type ImportProspectsResult = {
  csvImportId: string;
  imported: number;
  skippedDuplicate: number;
  skippedSuppressed: number;
  failed: number;
  errors: string[];
};

export async function importProspectsFromCsv(
  ownerUserId: string,
  rows: ProspectCsvRow[],
  source = "csv",
): Promise<ImportProspectsResult> {
  const csvImportId = randomUUID();
  const errors: string[] = [];
  let imported = 0;
  let skippedDuplicate = 0;
  let skippedSuppressed = 0;
  let failed = 0;

  const uniqueRows: ProspectCsvRow[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (seenEmails.has(email)) {
      skippedDuplicate++;
      continue;
    }
    seenEmails.add(email);
    uniqueRows.push({ ...row, email });
  }

  const emails = [...seenEmails];
  const [suppressed, existing] = await Promise.all([
    prisma.suppressionList.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
    prisma.prospect.findMany({
      where: { ownerUserId, email: { in: emails } },
      select: { email: true },
    }),
  ]);

  const suppressedSet = new Set(suppressed.map((s) => s.email));
  const existingSet = new Set(existing.map((p) => p.email));

  const toCreate = uniqueRows
    .filter((row) => {
      if (suppressedSet.has(row.email)) {
        skippedSuppressed++;
        return false;
      }
      if (existingSet.has(row.email)) {
        skippedDuplicate++;
        return false;
      }
      return true;
    })
    .map((row) => ({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      company: row.company ?? null,
      title: row.title ?? null,
      linkedInUrl: row.linkedInUrl ?? null,
      source,
      ownerUserId,
      csvImportId,
    }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.prospect.createMany({ data: batch });
      imported += result.count;
      failed += batch.length - result.count;
    } catch (err) {
      failed += batch.length;
      errors.push(err instanceof Error ? err.message : "Batch import failed");
    }
  }

  return {
    csvImportId,
    imported,
    skippedDuplicate,
    skippedSuppressed,
    failed,
    errors,
  };
}
