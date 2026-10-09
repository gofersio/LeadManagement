import { prisma } from "@/lib/prisma";

export async function deleteCampaign(campaignId: string, ownerUserId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerUserId },
    select: { id: true },
  });

  if (!campaign) return { ok: false as const, error: "Not found" };

  await prisma.$transaction(async (tx) => {
    const enrollments = await tx.campaignEnrollment.findMany({
      where: { campaignId },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);

    const steps = await tx.campaignStep.findMany({
      where: { campaignId },
      select: { id: true },
    });
    const stepIds = steps.map((s) => s.id);

    if (enrollmentIds.length > 0) {
      await tx.sendQueue.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await tx.emailMessage.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await tx.replyEvent.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
    }

    if (stepIds.length > 0) {
      await tx.sendQueue.deleteMany({ where: { stepId: { in: stepIds } } });
      await tx.emailMessage.deleteMany({ where: { stepId: { in: stepIds } } });
    }

    await tx.campaignEnrollment.deleteMany({ where: { campaignId } });
    await tx.campaignStep.deleteMany({ where: { campaignId } });
    await tx.campaign.delete({ where: { id: campaignId } });
  });

  return { ok: true as const };
}
