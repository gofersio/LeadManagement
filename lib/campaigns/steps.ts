import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activateCampaign } from "@/lib/campaigns/activate";

export type StepInput = {
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  isActive: boolean;
  variants?: { subject: string; body: string }[];
  activeVariantIndex?: number;
};

/** Update steps in place — avoids FK errors from SendQueue / EmailMessage. */
export async function replaceCampaignSteps(campaignId: string, steps: StepInput[]) {
  await prisma.$transaction(async (tx) => {
    // Cancel pending sends so step rows can be updated safely
    await tx.sendQueue.updateMany({
      where: {
        enrollment: { campaignId },
        status: { in: ["pending", "processing"] },
      },
      data: { status: "cancelled" },
    });

    for (const step of steps) {
      const variantsJson = (step.variants ?? []) as Prisma.InputJsonValue;
      const activeVariantIndex = step.activeVariantIndex ?? 0;

      await tx.campaignStep.upsert({
        where: {
          campaignId_stepNumber: {
            campaignId,
            stepNumber: step.stepNumber,
          },
        },
        create: {
          campaignId,
          stepNumber: step.stepNumber,
          delayDays: step.delayDays,
          subject: step.subject,
          body: step.body,
          isActive: step.isActive,
          variants: variantsJson,
          activeVariantIndex,
        },
        update: {
          delayDays: step.delayDays,
          subject: step.subject,
          body: step.body,
          isActive: step.isActive,
          variants: variantsJson,
          activeVariantIndex,
        },
      });
    }

    const keepNumbers = steps.map((s) => s.stepNumber);
    const orphaned = await tx.campaignStep.findMany({
      where: {
        campaignId,
        stepNumber: { notIn: keepNumbers },
      },
    });

    for (const step of orphaned) {
      const sentCount = await tx.emailMessage.count({ where: { stepId: step.id } });
      if (sentCount > 0) {
        await tx.campaignStep.update({
          where: { id: step.id },
          data: { isActive: false },
        });
      } else {
        await tx.sendQueue.deleteMany({ where: { stepId: step.id } });
        await tx.campaignStep.delete({ where: { id: step.id } });
      }
    }
  });

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (campaign?.status === "active") {
    await activateCampaign(campaignId);
  }
}
