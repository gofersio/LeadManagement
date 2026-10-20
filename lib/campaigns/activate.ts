import { computeScheduledFor, campaignScheduleFromCampaign } from "@/lib/campaigns/schedule";
import { prisma } from "@/lib/prisma";

export type ActivateResult =
  | { ok: true; queued: number }
  | { ok: false; error: string };

/** Enqueue step 1 for all active enrollments that haven't started. */
export async function activateCampaign(campaignId: string): Promise<ActivateResult> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      steps: { where: { isActive: true }, orderBy: { stepNumber: "asc" } },
      enrollments: { where: { status: "active", currentStep: 0 } },
    },
  });

  const firstStep = campaign.steps[0];
  if (!firstStep) {
    return { ok: false, error: "Campaign has no active steps. Add at least one sequence step." };
  }

  let queued = 0;

  for (const enrollment of campaign.enrollments) {
    const existing = await prisma.sendQueue.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: { in: ["pending", "processing"] },
      },
    });
    if (existing) continue;

    await prisma.sendQueue.create({
      data: {
        enrollmentId: enrollment.id,
        stepId: firstStep.id,
        mailboxId: enrollment.mailboxId,
        scheduledFor: computeScheduledFor(new Date(), firstStep.delayDays, campaignScheduleFromCampaign(campaign)),
        status: "pending",
      },
    });
    queued++;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });

  return { ok: true, queued };
}

export async function enrollProspects(
  campaignId: string,
  prospectIds: string[],
  mailboxId: string,
) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });

  if (prospectIds.length > 0) {
    await prisma.campaignEnrollment.createMany({
      data: prospectIds.map((prospectId) => ({
        campaignId,
        prospectId,
        mailboxId,
        status: "active",
        currentStep: 0,
      })),
      skipDuplicates: true,
    });
  }

  if (campaign.status === "active") {
    await activateCampaign(campaignId);
  }
}
