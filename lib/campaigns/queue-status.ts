import { prisma } from "@/lib/prisma";

export async function getCampaignQueueStatus(campaignId: string) {
  const items = await prisma.sendQueue.findMany({
    where: { enrollment: { campaignId } },
    orderBy: { scheduledFor: "asc" },
    include: {
      step: { select: { stepNumber: true, subject: true } },
      enrollment: {
        include: { prospect: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
    take: 20,
  });

  const pending = items.filter((i) => i.status === "pending");
  const failed = items.filter((i) => i.status === "failed");
  const sent = items.filter((i) => i.status === "sent");

  return {
    pendingCount: pending.length,
    failedCount: failed.length,
    sentCount: sent.length,
    nextScheduled: pending[0]?.scheduledFor ?? null,
    items: items.map((i) => ({
      id: i.id,
      status: i.status,
      scheduledFor: i.scheduledFor,
      stepNumber: i.step.stepNumber,
      prospect: `${i.enrollment.prospect.firstName} ${i.enrollment.prospect.lastName}`,
      email: i.enrollment.prospect.email,
      lastError: i.lastError,
    })),
  };
}
