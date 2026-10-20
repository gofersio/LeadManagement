"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Prospect } from "@prisma/client";

interface CampaignEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  enrolledIds: string[];
  onEnrolled: () => void;
  /** When set, adds prospects locally instead of PATCHing the campaign API */
  onSelectProspects?: (prospectIds: string[]) => void;
}

export function CampaignEnrollDialog({
  open,
  onOpenChange,
  campaignId,
  enrolledIds,
  onEnrolled,
  onSelectProspects,
}: CampaignEnrollDialogProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/prospects?picker=1&limit=2000")
      .then((r) => r.json())
      .then((data) => setProspects(data.prospects ?? []))
      .finally(() => setLoading(false));
    setSelected(new Set());
    setSearch("");
  }, [open]);

  const enrolledSet = new Set(enrolledIds);
  const available = prospects.filter((p) => !enrolledSet.has(p.id));
  const filtered = available.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.company?.toLowerCase().includes(q)
    );
  });

  const filteredIds = filtered.map((p) => p.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function enroll(ids = Array.from(selected)) {
    if (ids.length === 0) return;

    if (onSelectProspects) {
      onSelectProspects(ids);
      toast.success(`Added ${ids.length} prospect${ids.length === 1 ? "" : "s"}`);
      onEnrolled();
      onOpenChange(false);
      return;
    }

    if (!campaignId) return;

    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectIds: ids }),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(`Added ${ids.length} prospect${ids.length === 1 ? "" : "s"}`);
      onEnrolled();
      onOpenChange(false);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to add prospects");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add prospects to sequence</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="max-h-64 overflow-y-auto border border-outline-variant rounded-md divide-y divide-outline-variant/60">
          {loading ? (
            <p className="p-4 text-body-sm text-on-surface-variant">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-body-sm text-on-surface-variant">
              {available.length === 0
                ? "No leads available — import leads on the Leads page first."
                : "No matches."}
            </p>
          ) : (
            <>
              <label className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2 bg-surface-container-low cursor-pointer border-b border-outline-variant">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(event) => toggleAllFiltered(event.target.checked)}
                />
                <span className="text-body-sm font-medium">
                  {search.trim()
                    ? `Select all ${filtered.length} matches`
                    : `Select all ${filtered.length} leads`}
                </span>
              </label>
              {filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <div className="min-w-0">
                  <p className="text-body-sm font-medium truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-[11px] text-on-surface-variant truncate">{p.email}</p>
                </div>
              </label>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            disabled={saving || filteredIds.length === 0}
            onClick={() => enroll(filteredIds)}
          >
            {search.trim() ? `Add all ${filtered.length} matches` : `Add all ${available.length}`}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={enroll} disabled={saving || selected.size === 0}>
              {saving
                ? "Adding..."
                : `Add ${selected.size || ""} prospect${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
