import type { Campaign, CampaignEnrollment, CampaignStatus, GmailMailbox } from "@prisma/client";

export type CampaignListStats = {
  prospects: number;
  contacted: number;
  opened: number | null;
  replied: number;
  repliedPct: number;
  positive: number | null;
  emailsSent: number;
  progressCurrent: number;
  progressTotal: number;
  progressPct: number;
  score: number;
  emailAccounts: number;
};

type EnrollmentWithCount = Pick<CampaignEnrollment, "status" | "currentStep"> & {
  _count: { emailMessages: number };
};

export function computeCampaignListStats(
  enrollments: EnrollmentWithCount[],
  _stepCount: number,
): CampaignListStats {
  const prospects = enrollments.length;
  const contacted = enrollments.filter(
    (e) => e._count.emailMessages > 0 || e.currentStep > 0,
  ).length;
  const replied = enrollments.filter((e) => e.status === "replied").length;
  const emailsSent = enrollments.reduce((acc, e) => acc + e._count.emailMessages, 0);
  const progressCurrent = enrollments.filter((e) =>
    ["completed", "replied", "stopped", "unsubscribed", "bounced"].includes(e.status),
  ).length;
  const progressTotal = prospects;
  const progressPct =
    progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0;
  const repliedPct = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;

  let score = 0;
  if (prospects === 0) score = 0;
  else if (replied > 0) score = Math.min(95, 55 + repliedPct);
  else if (contacted > 0) score = 36;
  else score = 12;

  return {
    prospects,
    contacted,
    opened: null,
    replied,
    repliedPct,
    positive: null,
    emailsSent,
    progressCurrent,
    progressTotal,
    progressPct,
    score,
    emailAccounts: 1,
  };
}

export const CAMPAIGN_STATUS_DOT: Record<
  CampaignStatus,
  { label: string; dotClass: string }
> = {
  draft: { label: "Draft", dotClass: "bg-on-surface-variant" },
  active: { label: "Active", dotClass: "bg-primary" },
  paused: { label: "Paused", dotClass: "bg-error" },
  completed: { label: "Completed", dotClass: "bg-tertiary" },
};

export function scoreColor(score: number): string {
  if (score >= 70) return "bg-tertiary-container text-on-tertiary-container border-tertiary";
  if (score >= 40) return "bg-warning-container text-on-warning-container border-warning";
  return "bg-surface-container-high text-on-surface-variant border-outline-variant";
}

export type CampaignListItem = Campaign & {
  mailbox: Pick<GmailMailbox, "email">;
  owner: { fullName: string | null; email: string };
  _count: { enrollments: number; steps: number };
  stats: CampaignListStats;
};
