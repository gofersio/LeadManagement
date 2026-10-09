import { computeCampaignListStats } from "@/lib/campaigns/list-stats";
import type { CampaignDetailPayload } from "@/lib/campaigns/detail-query";
import {
  createInitialStepVariants,
  ensureStepVariantDefaults,
} from "@/lib/campaigns/step-variants";
import type { CampaignScheduleValues } from "@/components/campaigns/campaign-schedule-fields";
import type { CampaignStep, GmailMailbox, Prospect } from "@prisma/client";
import { createNewStepDraft } from "@/lib/campaigns/step-types";

export function createDraftStep(stepIndex: number, campaignId = "draft"): CampaignStep {
  const draft = createNewStepDraft(stepIndex);
  const { variants, activeVariantIndex } = createInitialStepVariants(
    draft.subject,
    draft.body,
  );
  return {
    id: `draft-step-${stepIndex}-${Date.now()}`,
    campaignId,
    stepNumber: draft.stepNumber,
    delayDays: draft.delayDays,
    subject: draft.subject,
    body: draft.body,
    isActive: draft.isActive,
    variants,
    activeVariantIndex,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CampaignStep;
}

export function computeDraftSequenceScore(steps: CampaignStep[]): number {
  if (steps.length === 0) return 0;
  let score = 24;
  for (const step of steps) {
    const synced = ensureStepVariantDefaults(step);
    if (synced.subject.trim().length > 10) score += 8;
    if (synced.body.trim().length > 40) score += 6;
  }
  return Math.min(87, score);
}

export function buildDraftCampaignPayload(params: {
  name: string;
  description?: string;
  mailboxId: string;
  mailbox: GmailMailbox;
  steps: CampaignStep[];
  prospects: Prospect[];
  selectedProspectIds: string[];
  schedule: CampaignScheduleValues;
}): CampaignDetailPayload {
  const enrollments = params.selectedProspectIds
    .map((prospectId) => {
      const prospect = params.prospects.find((p) => p.id === prospectId);
      if (!prospect) return null;
      return {
        id: `draft-enroll-${prospectId}`,
        campaignId: "draft",
        prospectId,
        mailboxId: params.mailboxId,
        status: "active" as const,
        currentStep: 0,
        gmailThreadId: null,
        lastSentAt: null,
        repliedAt: null,
        stoppedAt: null,
        stopReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        prospect,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const stats = computeCampaignListStats(
    enrollments.map((e) => ({
      status: e.status,
      currentStep: e.currentStep,
      _count: { emailMessages: 0 },
    })),
    params.steps.length,
  );
  stats.score = computeDraftSequenceScore(params.steps);

  const stepStats = Object.fromEntries(
    params.steps.map((s) => [s.id, { sent: 0, opened: null, replied: null }]),
  );

  return {
    id: "draft",
    name: params.name.trim() || "New Sequence",
    description: params.description?.trim() || null,
    status: "draft",
    mailboxId: params.mailboxId,
    ownerUserId: "",
    timezone: params.schedule.timezone,
    sendWindowStartHour: params.schedule.sendWindowStartHour,
    sendWindowEndHour: params.schedule.sendWindowEndHour,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: params.steps.map((s) => ensureStepVariantDefaults(s)),
    mailbox: params.mailbox,
    enrollments,
    stats,
    stepStats,
  };
}
