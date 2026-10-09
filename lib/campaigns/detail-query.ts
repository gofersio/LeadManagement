import { computeCampaignListStats, type CampaignListStats } from "@/lib/campaigns/list-stats";
import { prisma } from "@/lib/prisma";
import type {
  Campaign,
  CampaignEnrollment,
  CampaignStep,
  GmailMailbox,
  Prospect,
} from "@prisma/client";

export type StepStats = {
  sent: number;
  opened: number | null;
  replied: number | null;
};

export type CampaignDetailPayload = Campaign & {
  steps: CampaignStep[];
  mailbox: GmailMailbox;
  enrollments: (CampaignEnrollment & { prospect: Prospect })[];
  stats: CampaignListStats;
  stepStats: Record<string, StepStats>;
};

export async function getCampaignDetail(
  campaignId: string,
  ownerUserId: string,
): Promise<CampaignDetailPayload | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerUserId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      mailbox: true,
      enrollments: {
        include: {
          prospect: true,
          _count: { select: { emailMessages: true } },
        },
      },
    },
  });

  if (!campaign) return null;

  const stepIds = campaign.steps.map((s) => s.id);
  const sentByStep =
    stepIds.length > 0
      ? await prisma.emailMessage.groupBy({
          by: ["stepId"],
          where: {
            stepId: { in: stepIds },
            status: "sent",
          },
          _count: { id: true },
        })
      : [];

  const stepStats: Record<string, StepStats> = {};
  for (const step of campaign.steps) {
    const row = sentByStep.find((r) => r.stepId === step.id);
    stepStats[step.id] = {
      sent: row?._count.id ?? 0,
      opened: null,
      replied: null,
    };
  }

  const stats = computeCampaignListStats(
    campaign.enrollments.map((e) => ({
      status: e.status,
      currentStep: e.currentStep,
      _count: { emailMessages: e._count.emailMessages },
    })),
    campaign.steps.length,
  );

  const { enrollments, ...rest } = campaign;
  const enrollmentsClean = enrollments.map(({ _count: _c, ...e }) => e);

  return {
    ...rest,
    enrollments: enrollmentsClean,
    stats,
    stepStats,
  };
}
