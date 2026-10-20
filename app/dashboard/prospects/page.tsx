"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { CsvImportDialog } from "@/components/prospects/csv-import-dialog";
type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  title: string | null;
  source: string;
  status: string;
};

type LeadPage = {
  prospects: LeadRow[];
  total: number;
  sources?: string[];
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const LEAD_STATUSES = [
  "new",
  "contacted",
  "replied",
  "unsubscribed",
  "bounced",
  "stopped",
] as const;

type SequenceOption = { id: string; name: string };

function pageCacheKey(page: number, pageSize: number, source: string) {
  return `${source}|${pageSize}|${page}`;
}

async function fetchLeadPage(
  page: number,
  pageSize: number,
  source: string,
  includeSources: boolean,
): Promise<LeadPage> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (source) params.set("source", source);
  if (includeSources) params.set("sources", "1");

  const res = await fetch(`/api/prospects?${params}`);
  const data = await res.json();
  return {
    prospects: data.prospects ?? [],
    total: data.total ?? 0,
    sources: data.sources,
  };
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [source, setSource] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Map<string, LeadRow>>(new Map());
  const [bulkStatus, setBulkStatus] = useState<(typeof LEAD_STATUSES)[number]>("contacted");
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [sequenceId, setSequenceId] = useState("");
  const [acting, setActing] = useState(false);
  const cacheRef = useRef(new Map<string, LeadPage>());
  const needsSources = sources.length === 0;

  useEffect(() => {
    const key = pageCacheKey(page, pageSize, source);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setProspects(cached.prospects);
      setTotal(cached.total);
      setLoading(false);
    }

    let cancelled = false;

    async function load() {
      if (!cached) setLoading(prospects.length === 0);
      const data = await fetchLeadPage(page, pageSize, source, needsSources || page === 1);
      if (cancelled) return;

      cacheRef.current.set(key, data);
      setProspects(data.prospects);
      setTotal(data.total);
      if (data.sources) setSources(data.sources);
      setLoading(false);

      const pageCount = Math.max(1, Math.ceil(data.total / pageSize));
      for (const neighbor of [page - 1, page + 1]) {
        if (neighbor < 1 || neighbor > pageCount) continue;
        const neighborKey = pageCacheKey(neighbor, pageSize, source);
        if (cacheRef.current.has(neighborKey)) continue;
        fetchLeadPage(neighbor, pageSize, source, false).then((next) => {
          cacheRef.current.set(neighborKey, next);
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // prospects.length is only used to decide the first spinner
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, source, refreshKey]);

  function reloadFromStart() {
    cacheRef.current.clear();
    setSelected(new Map());
    setPage(1);
    setRefreshKey((key) => key + 1);
  }

  const selectedIds = Array.from(selected.keys());
  const pageIds = prospects.map((lead) => lead.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleLead(lead: LeadRow) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.set(lead.id, lead);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((current) => {
      const next = new Map(current);
      for (const lead of prospects) {
        if (checked) next.set(lead.id, lead);
        else next.delete(lead.id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (selected.size === 0 || sequences.length > 0) return;
    let cancelled = false;
    fetch("/api/campaigns")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const options = data.map((campaign: { id: string; name: string }) => ({
          id: campaign.id,
          name: campaign.name,
        }));
        setSequences(options);
        if (options[0]) setSequenceId((current) => current || options[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selected.size, sequences.length]);

  async function applyStatus() {
    if (selectedIds.length === 0) return;
    setActing(true);
    const res = await fetch("/api/prospects/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action: "status", status: bulkStatus }),
    });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update leads");
      return;
    }
    toast.success(`Updated ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}`);
    reloadFromStart();
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setActing(true);
    const res = await fetch("/api/prospects/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action: "delete" }),
    });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delete leads");
      return;
    }
    toast.success(`Deleted ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}`);
    reloadFromStart();
  }

  async function addToSequence() {
    if (!sequenceId || selectedIds.length === 0) return;
    setActing(true);
    const res = await fetch(`/api/campaigns/${sequenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectIds: selectedIds }),
    });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to add leads to sequence");
      return;
    }
    toast.success(
      `Added ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"} to sequence`,
    );
    setSelected(new Map());
  }

  function exportSelected() {
    const rows = Array.from(selected.values());
    const header = ["first_name", "last_name", "email", "company", "title", "source", "status"];
    const lines = [
      header.join(","),
      ...rows.map((lead) =>
        [
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.company ?? "",
          lead.title ?? "",
          lead.source,
          lead.status,
        ]
          .map((value) => `"${value.replaceAll('"', '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreate(data: Record<string, string>) {
    const res = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to create lead");
      return;
    }
    toast.success("Lead added");
    setOpen(false);
    reloadFromStart();
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="Leads"
        subtitle="Manage your prospect list"
        actions={
          <>
            <CsvImportDialog onImported={reloadFromStart} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add Lead</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Lead</DialogTitle>
                </DialogHeader>
                <ProspectForm onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          Data source
          <select
            value={source}
            onChange={(event) => {
              cacheRef.current.clear();
              setSource(event.target.value);
              setPage(1);
            }}
            className="h-9 min-w-[160px] rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface"
          >
            <option value="">All sources</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          Rows
          <select
            value={pageSize}
            onChange={(event) => {
              cacheRef.current.clear();
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="text-body-sm font-medium text-on-surface mr-1">
            {selectedIds.length} selected
          </span>
          <select
            value={bulkStatus}
            onChange={(event) =>
              setBulkStatus(event.target.value as (typeof LEAD_STATUSES)[number])
            }
            className="h-8 rounded border border-outline-variant bg-surface-container-lowest px-2 text-body-sm"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="secondary" disabled={acting} onClick={applyStatus}>
            Set status
          </Button>
          <select
            value={sequenceId}
            onChange={(event) => setSequenceId(event.target.value)}
            className="h-8 max-w-[220px] rounded border border-outline-variant bg-surface-container-lowest px-2 text-body-sm"
          >
            <option value="">{sequences.length ? "Choose sequence" : "Add to sequence"}</option>
            {sequences.map((sequence) => (
              <option key={sequence.id} value={sequence.id}>
                {sequence.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={acting || !sequenceId}
            onClick={addToSequence}
          >
            Add
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={acting} onClick={exportSelected}>
            Export
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={acting} onClick={deleteSelected}>
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={acting}
            onClick={() => setSelected(new Map())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all leads on this page"
                  checked={allOnPageSelected}
                  onChange={(event) => togglePage(event.target.checked)}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && prospects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : prospects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-on-surface-variant">
                  {source
                    ? `No leads from “${source}”.`
                    : "No leads yet. Add your first lead to get started."}
                </TableCell>
              </TableRow>
            ) : (
              prospects.map((p) => (
                <TableRow key={p.id} className={selected.has(p.id) ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.firstName} ${p.lastName}`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleLead(p)}
                    />
                  </TableCell>
                  <TableCell className="font-bold">
                    {p.firstName} {p.lastName}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.company ?? "—"}</TableCell>
                  <TableCell>{p.title ?? "—"}</TableCell>
                  <TableCell>{p.source}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status.toUpperCase()}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <LeadsPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function LeadsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = visiblePages(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant px-4 py-3">
      <p className="text-body-sm text-on-surface-variant">
        {total === 0
          ? "0 leads"
          : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {pages.map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-1 text-on-surface-variant">
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={item === page ? "default" : "secondary"}
              className={item === page ? "text-white" : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function visiblePages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}
