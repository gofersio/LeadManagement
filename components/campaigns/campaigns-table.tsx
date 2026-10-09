"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  CAMPAIGN_STATUS_DOT,
  scoreColor,
  type CampaignListItem,
} from "@/lib/campaigns/list-stats";
import { getTimezoneLabel } from "@/lib/campaigns/timezones";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Status (All)" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

interface CampaignsTableProps {
  campaigns: CampaignListItem[];
  loading: boolean;
  ownerInitial: string;
  onRefresh: () => void;
  onDelete: (campaign: CampaignListItem) => void;
  deletingId: string | null;
  duplicatingId: string | null;
  onDuplicate: (campaign: CampaignListItem) => Promise<void>;
}

export function CampaignsTable({
  campaigns,
  loading,
  ownerInitial,
  onRefresh,
  onDelete,
  deletingId,
  duplicatingId,
  onDuplicate,
}: CampaignsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleCampaignActive(campaign: CampaignListItem) {
    if (campaign.status === "draft" || campaign.status === "completed") {
      toast.message("Open the campaign to activate or edit a completed sequence.");
      return;
    }

    const nextStatus: CampaignStatus = campaign.status === "active" ? "paused" : "active";

    setTogglingId(campaign.id);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setTogglingId(null);

    if (res.ok) {
      toast.success(nextStatus === "active" ? "Campaign resumed" : "Campaign paused");
      onRefresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update campaign");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Icon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <Input
            placeholder="Search here..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded border border-outline-variant bg-surface-container-low px-3 text-body-sm min-w-[140px]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button asChild className="ml-auto">
          <Link href="/dashboard/campaigns/new">Create Sequence</Link>
        </Button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">Sequence Name</TableHead>
                <TableHead>Sequence Progress</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Contacted</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Replied</TableHead>
                <TableHead>Positive</TableHead>
                <TableHead>Email Accounts</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead className="w-24">Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-on-surface-variant">
                    Loading sequences...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-on-surface-variant">
                    {campaigns.length === 0
                      ? "No sequences yet. Create your first campaign."
                      : "No sequences match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((campaign) => {
                  const statusMeta = CAMPAIGN_STATUS_DOT[campaign.status];
                  const { stats } = campaign;
                  const isActive = campaign.status === "active";

                  return (
                    <TableRow key={campaign.id} className="hover:bg-surface-container-low/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(campaign.id)}
                          onChange={() => toggleSelect(campaign.id)}
                          aria-label={`Select ${campaign.name}`}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-start gap-3 min-w-[200px]">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            disabled={
                              togglingId === campaign.id ||
                              campaign.status === "draft" ||
                              campaign.status === "completed"
                            }
                            onClick={() => toggleCampaignActive(campaign)}
                            className={cn(
                              "relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40",
                              isActive ? "bg-primary" : "bg-outline-variant",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                                isActive && "translate-x-4",
                              )}
                            />
                          </button>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/campaigns/${campaign.id}`}
                              className="font-semibold text-body-md text-on-surface hover:text-primary line-clamp-2"
                            >
                              {campaign.name}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={cn("h-2 w-2 rounded-full shrink-0", statusMeta.dotClass)}
                              />
                              <span className="text-[11px] text-on-surface-variant">
                                {statusMeta.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">
                              {campaign.mailbox.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <CircularProgress
                          value={stats.progressCurrent}
                          max={stats.progressTotal || 1}
                        />
                      </TableCell>

                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex h-9 w-9 items-center justify-center rounded-full border text-label-md font-bold",
                            scoreColor(stats.score),
                          )}
                        >
                          {stats.score}
                        </span>
                      </TableCell>

                      <TableCell className="text-body-sm font-medium">{stats.prospects}</TableCell>
                      <TableCell className="text-body-sm font-medium">{stats.contacted}</TableCell>
                      <TableCell className="text-body-sm text-on-surface-variant">—</TableCell>
                      <TableCell className="text-body-sm">
                        <span className="font-medium">{stats.replied}</span>
                        {stats.contacted > 0 && (
                          <span className="text-on-surface-variant text-[11px] ml-1">
                            ({stats.repliedPct}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-body-sm text-on-surface-variant">—</TableCell>
                      <TableCell className="text-body-sm font-medium">{stats.emailAccounts}</TableCell>
                      <TableCell className="text-body-sm text-on-surface-variant max-w-[100px] truncate">
                        {getTimezoneLabel(campaign.timezone)}
                      </TableCell>

                      <TableCell>
                        <div className="relative flex items-center gap-1">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-label-sm font-bold"
                            title={campaign.owner.fullName ?? campaign.owner.email}
                          >
                            {ownerInitial}
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant"
                            onClick={() =>
                              setMenuOpenId(menuOpenId === campaign.id ? null : campaign.id)
                            }
                            aria-label="More actions"
                          >
                            <Icon name="more_vert" size={18} />
                          </button>
                          {menuOpenId === campaign.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpenId(null)}
                              />
                              <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg py-1.5">
                                <CampaignMenuItem
                                  icon="edit"
                                  label="Edit"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    router.push(`/dashboard/campaigns/${campaign.id}`);
                                  }}
                                />
                                <CampaignMenuItem
                                  icon="content_copy"
                                  label="Duplicate"
                                  disabled={duplicatingId === campaign.id}
                                  onClick={async () => {
                                    setMenuOpenId(null);
                                    await onDuplicate(campaign);
                                  }}
                                />
                                <CampaignMenuItem
                                  icon="delete"
                                  label="Delete"
                                  destructive
                                  disabled={deletingId === campaign.id}
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onDelete(campaign);
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function CampaignMenuItem({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-body-sm transition-colors disabled:opacity-50",
        destructive
          ? "text-on-surface hover:bg-surface-container-low"
          : "text-on-surface hover:bg-surface-container-low",
      )}
    >
      <Icon
        name={icon}
        size={18}
        className={cn("text-on-surface-variant", destructive && "text-on-surface-variant")}
      />
      {label}
    </button>
  );
}
