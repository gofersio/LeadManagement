"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { EnrollmentStatusBadge } from "@/components/ui/status-badge";
import { CsvImportDialog } from "@/components/prospects/csv-import-dialog";
import { CampaignEnrollDialog } from "@/components/campaigns/campaign-enroll-dialog";
import type { CampaignDetailPayload } from "@/lib/campaigns/detail-query";
import { cn } from "@/lib/utils";

interface CampaignProspectsTabProps {
  campaign: CampaignDetailPayload;
  onGoToSteps: () => void;
  onRefresh: () => void;
  enrollOpen?: boolean;
  onEnrollOpenChange?: (open: boolean) => void;
  onAddProspects?: (prospectIds: string[]) => void;
}

export function CampaignProspectsTab({
  campaign,
  onGoToSteps,
  onRefresh,
  enrollOpen: enrollOpenProp,
  onEnrollOpenChange,
  onAddProspects,
}: CampaignProspectsTabProps) {
  const [enrollOpenInternal, setEnrollOpenInternal] = useState(false);
  const enrollOpen = enrollOpenProp ?? enrollOpenInternal;
  const setEnrollOpen = onEnrollOpenChange ?? setEnrollOpenInternal;
  const [search, setSearch] = useState("");
  const hasSteps = campaign.steps.length > 0;
  const enrollments = campaign.enrollments;

  const stats = useMemo(() => {
    const total = enrollments.length;
    const contacted = campaign.stats.contacted;
    const notContacted = total - contacted;
    const replied = campaign.stats.replied;
    return { total, notContacted, contacted, opened: 0, replied, clicked: 0 };
  }, [enrollments.length, campaign.stats]);

  const filtered = enrollments.filter((e) => {
    const q = search.toLowerCase();
    const name = `${e.prospect.firstName} ${e.prospect.lastName ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      e.prospect.email.toLowerCase().includes(q) ||
      e.prospect.company?.toLowerCase().includes(q)
    );
  });

  if (enrollments.length === 0) {
    return (
      <>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            <div className="flex-1 p-8 lg:p-10">
              <h2 className="text-headline-sm font-semibold text-on-surface mb-2">
                Add prospects to sequence
              </h2>
              <p className="text-body-sm text-on-surface-variant mb-6 max-w-md">
                After adding your contacts, each one will appear here with their own step
                progress and status.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <CsvImportDialog
                  onImported={onRefresh}
                  onMatched={(ids) => onAddProspects?.(ids)}
                  triggerVariant="default"
                  triggerClassName="text-white"
                />
                <Link
                  href="/dashboard/prospects"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded border border-primary text-primary text-body-sm font-medium hover:bg-primary/5 transition-colors"
                >
                  <Icon name="search" size={16} />
                  Find New Leads
                </Link>
                <button
                  type="button"
                  disabled={!hasSteps}
                  onClick={() => setEnrollOpen(true)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded border border-outline-variant text-on-surface-variant text-body-sm font-medium disabled:opacity-40"
                >
                  <Icon name="add" size={16} />
                  Search &amp; Add
                </button>
              </div>
              {!hasSteps ? (
                <p className="text-body-sm text-on-surface">
                  <strong>Create at-least 1 step</strong> to add prospects.{" "}
                  <button
                    type="button"
                    onClick={onGoToSteps}
                    className="text-primary hover:underline font-medium"
                  >
                    Go to Steps
                  </button>
                </p>
              ) : (
                <p className="text-body-sm text-on-surface-variant">
                  Import leads or search your existing leads to enroll them in this sequence.
                </p>
              )}
            </div>
            <div className="lg:w-[340px] shrink-0 bg-gradient-to-br from-primary/80 to-tertiary/70 p-8 flex flex-col items-center justify-center text-white min-h-[220px]">
              <div className="relative w-full max-w-[260px] aspect-video rounded-lg bg-black/20 flex items-center justify-center mb-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg">
                  <Icon name="play_arrow" size={28} filled />
                </span>
              </div>
              <p className="text-[13px] font-semibold text-center">Add Prospects In Sequence</p>
            </div>
          </div>
        </div>
        <CampaignEnrollDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          campaignId={onAddProspects ? undefined : campaign.id}
          enrolledIds={[]}
          onEnrolled={onRefresh}
          onSelectProspects={onAddProspects}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Icon
              name="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Link
            href="/dashboard/prospects"
            className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-medium text-on-primary hover:bg-primary-container"
          >
            <Icon name="person_add" size={16} />
            Add New Lead
          </Link>
          <div className="flex items-center gap-1 ml-auto">
            <ToolbarIcon name="filter_list" title="Filter" />
            <ToolbarIcon name="refresh" title="Refresh" onClick={onRefresh} />
            <ToolbarIcon name="download" title="Export" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatPill label="Total" value={stats.total} active />
          <StatPill label="Not Contacted" value={stats.notContacted} />
          <StatPill label="Contacted" value={stats.contacted} />
          <StatPill label="Opened" value={stats.opened} />
          <StatPill label="Replied" value={stats.replied} />
          <StatPill label="Clicked" value={stats.clicked} />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" aria-label="Select all" />
                  </th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Name</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Current Step</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Current step stats</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Outcome</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Tags</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${e.prospect.firstName}`} />
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <p className="font-semibold text-on-surface">
                        {e.prospect.firstName} {e.prospect.lastName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <EnrollmentStatusBadge status={e.status} />
                      </div>
                      <p className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <Icon name="check_circle" size={12} className="text-tertiary" />
                        {e.prospect.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {e.currentStep > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                          <Icon name="mail" size={16} />
                          Step {e.currentStep}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span title="Sent"><Icon name="send" size={16} /></span>
                        <span title="Opened"><Icon name="drafts" size={16} /></span>
                        <span title="Clicked"><Icon name="ads_click" size={16} /></span>
                        <span title="Replied"><Icon name="reply" size={16} /></span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 h-8 px-3 rounded border border-outline-variant text-[12px] text-on-surface-variant hover:bg-surface-container-low"
                      >
                        Add Outcome
                        <Icon name="expand_more" size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">—</td>
                    <td className="px-4 py-3 text-[12px] text-on-surface-variant whitespace-nowrap">
                      {formatDistanceToNow(new Date(e.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <CampaignEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        campaignId={onAddProspects ? undefined : campaign.id}
        enrolledIds={enrollments.map((e) => e.prospectId)}
        onEnrolled={onRefresh}
        onSelectProspects={onAddProspects}
      />
    </>
  );
}

function StatPill({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2 min-w-[90px]",
        active
          ? "bg-primary/5 border-primary/20"
          : "bg-surface-container-lowest border-outline-variant",
      )}
    >
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <p className={cn("text-lg font-bold", active ? "text-primary" : "text-on-surface")}>
        {value}
      </p>
    </div>
  );
}

function ToolbarIcon({
  name,
  title,
  onClick,
}: {
  name: string;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-2 rounded hover:bg-surface-container-high text-on-surface-variant"
    >
      <Icon name={name} size={18} />
    </button>
  );
}
