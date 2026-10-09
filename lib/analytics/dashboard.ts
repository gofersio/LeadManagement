import { format, subDays, startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDashboardAnalytics(userId: string) {
  const weekStart = startOfDay(subDays(new Date(), 6));
  const weekEnd = startOfDay(subDays(new Date(), -1));

  const [
    sentCount,
    repliedCount,
    pendingFollowUps,
    stoppedCount,
    activeCampaigns,
    recentReplies,
    unreadNotifications,
    weeklySentRows,
    weeklyRepliedRows,
  ] = await Promise.all([
    prisma.emailMessage.count({
      where: { status: "sent", mailbox: { userId } },
    }),
    prisma.campaignEnrollment.count({
      where: { status: "replied", campaign: { ownerUserId: userId } },
    }),
    prisma.sendQueue.count({
      where: { status: "pending", mailbox: { userId } },
    }),
    prisma.campaignEnrollment.count({
      where: {
        status: { in: ["stopped", "bounced", "unsubscribed"] },
        campaign: { ownerUserId: userId },
      },
    }),
    prisma.campaign.findMany({
      where: { ownerUserId: userId, status: { in: ["active", "paused", "draft"] } },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.replyEvent.findMany({
      where: { mailbox: { userId } },
      include: {
        enrollment: {
          include: { prospect: true, campaign: true },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: 5,
    }),
    prisma.appNotification.count({
      where: { userId, readAt: null },
    }),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "sentAt") AS day, COUNT(*)::bigint AS count
      FROM "EmailMessage" em
      JOIN "GmailMailbox" mb ON mb.id = em."mailboxId"
      WHERE em.status = 'sent'
        AND mb."userId" = ${userId}
        AND em."sentAt" >= ${weekStart}
        AND em."sentAt" < ${weekEnd}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "detectedAt") AS day, COUNT(*)::bigint AS count
      FROM "ReplyEvent" re
      JOIN "GmailMailbox" mb ON mb.id = re."mailboxId"
      WHERE mb."userId" = ${userId}
        AND re."detectedAt" >= ${weekStart}
        AND re."detectedAt" < ${weekEnd}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const campaignIds = activeCampaigns.map((c) => c.id);

  const [sentByCampaign, repliedByCampaign] =
    campaignIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.$queryRaw<{ campaignId: string; count: bigint }[]>`
            SELECT ce."campaignId", COUNT(em.id)::bigint AS count
            FROM "EmailMessage" em
            JOIN "CampaignEnrollment" ce ON ce.id = em."enrollmentId"
            WHERE ce."campaignId" IN (${Prisma.join(campaignIds)})
              AND em.status = 'sent'
            GROUP BY ce."campaignId"
          `,
          prisma.campaignEnrollment.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaignIds }, status: "replied" },
            _count: { _all: true },
          }),
        ]);

  const sentMap = new Map(sentByCampaign.map((r) => [r.campaignId, Number(r.count)]));
  const repliedMap = new Map(
    repliedByCampaign.map((r) => [r.campaignId, r._count._all]),
  );

  const replyRate = sentCount > 0 ? ((repliedCount / sentCount) * 100).toFixed(1) : "0";

  const sentByDay = new Map(
    weeklySentRows.map((r) => [format(new Date(r.day), "yyyy-MM-dd"), Number(r.count)]),
  );
  const repliedByDay = new Map(
    weeklyRepliedRows.map((r) => [format(new Date(r.day), "yyyy-MM-dd"), Number(r.count)]),
  );

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const day = subDays(new Date(), 6 - i);
    const key = format(day, "yyyy-MM-dd");
    const label = format(day, "EEE").toUpperCase();
    return {
      label,
      sent: sentByDay.get(key) ?? 0,
      replied: repliedByDay.get(key) ?? 0,
      muted: i >= 5,
    };
  });

  const campaignsWithStats = activeCampaigns.map((c) => ({
    ...c,
    sentCount: sentMap.get(c.id) ?? 0,
    repliedCount: repliedMap.get(c.id) ?? 0,
  }));

  return {
    sentCount,
    repliedCount,
    pendingFollowUps,
    stoppedCount,
    replyRate,
    activeCampaigns: campaignsWithStats,
    recentReplies,
    unreadNotifications,
    chartData,
  };
}
