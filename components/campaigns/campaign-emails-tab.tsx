"use client";

import {
  formatInCampaignTimezone,
  getTimezoneLabel,
} from "@/lib/campaigns/timezones";
import type { CampaignDetailPayload } from "@/lib/campaigns/detail-query";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QueueStatus = {
  pendingCount: number;
  failedCount: number;
  sentCount: number;
  nextScheduled: string | null;
  items: {
    id: string;
    status: string;
    scheduledFor: string;
    stepNumber: number;
    prospect: string;
    email: string;
    lastError: string | null;
  }[];
};

interface CampaignEmailsTabProps {
  campaign: CampaignDetailPayload;
  queueStatus: QueueStatus | null;
}

export function CampaignEmailsTab({ campaign, queueStatus }: CampaignEmailsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <EmailStatPill label="Emails sent" value={campaign.stats.emailsSent} active />
        <EmailStatPill label="Pending" value={queueStatus?.pendingCount ?? 0} />
        <EmailStatPill label="Failed" value={queueStatus?.failedCount ?? 0} />
        <EmailStatPill label="Contacted" value={campaign.stats.contacted} />
      </div>

      {queueStatus && queueStatus.items.length > 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-body-md font-semibold">Send queue</h3>
              {queueStatus.nextScheduled && (
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  Next due:{" "}
                  {formatInCampaignTimezone(queueStatus.nextScheduled, campaign.timezone)} (
                  {getTimezoneLabel(campaign.timezone)})
                </p>
              )}
            </div>
            <div className="relative w-full max-w-xs sm:w-48">
              <Icon
                name="search"
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <Input placeholder="Search" className="h-8 pl-8 text-[12px]" disabled />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueStatus.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.prospect}</p>
                    <p className="text-[11px] text-on-surface-variant">{item.email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-primary text-[12px] font-medium">
                      <Icon name="mail" size={14} />
                      Step {item.stepNumber}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px]">{item.status.toUpperCase()}</TableCell>
                  <TableCell className="text-[12px]">
                    {formatInCampaignTimezone(item.scheduledFor, campaign.timezone)}
                    {item.lastError && (
                      <p className="text-error text-[11px] mt-1">{item.lastError}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center">
          <Icon name="mail" size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-body-md font-medium text-on-surface">No emails in the send queue</p>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Emails appear here once prospects are enrolled and steps are scheduled.
          </p>
        </div>
      )}
    </div>
  );
}

function EmailStatPill({
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
      className={
        active
          ? "rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 min-w-[100px]"
          : "rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 min-w-[100px]"
      }
    >
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <p className={`text-lg font-bold ${active ? "text-primary" : "text-on-surface"}`}>{value}</p>
    </div>
  );
}
