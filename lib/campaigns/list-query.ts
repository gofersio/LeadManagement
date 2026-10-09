import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CampaignListStats } from "@/lib/campaigns/list-stats";

type ContactedAgg = { campaignId: string; count: bigint };

export async function getCampaignsForList(ownerUserId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { ownerUserId },
    select: {
      id: true,
      name: true,
      status: true,
      timezone: true,
      sendWindowStartHour: true,
      sendWindowEndHour: true,
      mailboxId: true,
      ownerUserId: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      mailbox: { select: { email: true } },
      owner: { select: { fullName: true, email: true } },
      _count: { select: { enrollments: true, steps: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.id);

  const [statusAgg, contactedAgg] = await Promise.all([
    prisma.campaignEnrollment.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<ContactedAgg[]>`
      SELECT ce."campaignId", COUNT(*)::bigint AS count
      FROM "CampaignEnrollment" ce
      WHERE ce."campaignId" IN (${Prisma.join(campaignIds)})
        AND (
          ce."currentStep" > 0
          OR EXISTS (
            SELECT 1 FROM "EmailMessage" em
            WHERE em."enrollmentId" = ce.id AND em.status = 'sent'
          )
        )
      GROUP BY ce."campaignId"
    `,
  ]);

  const contactedMap = new Map(
    contactedAgg.map((r) => [r.campaignId, Number(r.count)]),
  );

  const statusMap = new Map<string, Map<string, number>>();
  for (const row of statusAgg) {
    if (!statusMap.has(row.campaignId)) statusMap.set(row.campaignId, new Map());
    statusMap.get(row.campaignId)!.set(row.status, row._count._all);
  }

  return campaigns.map((campaign) => {
    const prospects = campaign._count.enrollments;
    const statuses = statusMap.get(campaign.id) ?? new Map<string, number>();
    const replied = statuses.get("replied") ?? 0;
    const contacted = contactedMap.get(campaign.id) ?? 0;
    const progressCurrent = ["completed", "replied", "stopped", "unsubscribed", "bounced"].reduce(
      (sum, s) => sum + (statuses.get(s) ?? 0),
      0,
    );
    const repliedPct = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;

    let score = 0;
    if (prospects === 0) score = 0;
    else if (replied > 0) score = Math.min(95, 55 + repliedPct);
    else if (contacted > 0) score = 36;
    else score = 12;

    const stats: CampaignListStats = {
      prospects,
      contacted,
      opened: null,
      replied,
      repliedPct,
      positive: null,
      emailsSent: 0,
      progressCurrent,
      progressTotal: prospects,
      progressPct:
        prospects > 0 ? Math.min(100, Math.round((progressCurrent / prospects) * 100)) : 0,
      score,
      emailAccounts: 1,
    };

    return { ...campaign, stats };
  });
}
