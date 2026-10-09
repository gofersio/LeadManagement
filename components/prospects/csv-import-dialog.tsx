"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CSV_TEMPLATE, parseProspectCsv } from "@/lib/prospects/parse-csv";

type ImportResult = {
  imported: number;
  skippedDuplicate: number;
  skippedSuppressed: number;
  failed: number;
  totalRows: number;
  parseErrors: { row: number; message: string }[];
  errors: string[];
};

interface CsvImportDialogProps {
  onImported: () => void;
  triggerClassName?: string;
  triggerVariant?: "default" | "secondary" | "ghost";
}

export function CsvImportDialog({
  onImported,
  triggerClassName,
  triggerVariant = "secondary",
}: CsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseProspectCsv> | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleFileChange(selected: File | null) {
    setFile(selected);
    setResult(null);

    if (!selected) {
      setPreview(null);
      return;
    }

    const text = await selected.text();
    setPreview(parseProspectCsv(text));
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", "csv");

    const res = await fetch("/api/prospects/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setImporting(false);

    if (!res.ok) {
      toast.error(data.error ?? "Import failed");
      if (data.parseErrors?.length) setResult(data as ImportResult);
      return;
    }

    setResult(data);
    onImported();

    if (data.imported > 0) {
      toast.success(`Imported ${data.imported} lead(s)`);
    } else {
      toast.message("No new leads imported");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName}>
          <Icon name="cloud_upload" size={16} className="mr-1.5" />
          Import via CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-body-sm text-on-surface-variant">
            Upload a CSV with columns for email (required) and optionally first name, last name,
            company, title, and LinkedIn URL. Duplicate emails are skipped.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-body-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-on-primary"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />

          {preview && (
            <div className="space-y-2">
              <p className="text-label-md text-on-surface">
                Preview: {preview.rows.length} valid row(s)
                {preview.errors.length > 0 && ` · ${preview.errors.length} row error(s)`}
              </p>
              {preview.rows.length > 0 && (
                <div className="border border-outline-variant rounded overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Company</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row) => (
                        <tr key={row.email} className="border-t border-outline-variant">
                          <td className="p-2">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="p-2">{row.email}</td>
                          <td className="p-2">{row.company ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 5 && (
                    <p className="p-2 text-body-sm text-on-surface-variant">
                      + {preview.rows.length - 5} more row(s)
                    </p>
                  )}
                </div>
              )}
              {preview.errors.length > 0 && (
                <ul className="text-body-sm text-error space-y-1 max-h-24 overflow-y-auto">
                  {preview.errors.slice(0, 10).map((err) => (
                    <li key={`${err.row}-${err.message}`}>{err.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && (
            <div className="p-4 bg-surface-container-low rounded border border-outline-variant text-body-sm space-y-1">
              <p>
                <strong>{result.imported}</strong> imported ·{" "}
                <strong>{result.skippedDuplicate}</strong> duplicate(s) skipped ·{" "}
                <strong>{result.skippedSuppressed}</strong> suppressed
              </p>
              {result.failed > 0 && <p className="text-error">{result.failed} failed to import</p>}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              {result ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || !preview?.rows.length || importing}
            >
              {importing ? "Importing..." : "Import leads"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
