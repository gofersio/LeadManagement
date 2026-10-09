import { NextResponse } from "next/server";
import { activateCampaign } from "@/lib/campaigns/activate";
import { getCampaignQueueStatus } from "@/lib/campaigns/queue-status";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { processSendQueue } from "@/lib/jobs/process-send-queue";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function assertCampaignAccess(campaignId: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, ownerUserId: userId },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await assertCampaignAccess(id, user.profile.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const queue = await getCampaignQueueStatus(id);
  const emailCount = await prisma.emailMessage.count({
    where: { enrollment: { campaignId: id }, status: "sent" },
  });

  return NextResponse.json({
    campaignStatus: campaign.status,
    emailsSent: emailCount,
    enrollments: await prisma.campaignEnrollment.count({ where: { campaignId: id } }),
    queue,
  });
}

/** Re-queue due enrollments and process the send queue (for local dev / manual send). */
export async function POST(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await assertCampaignAccess(id, user.profile.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.status !== "active") {
    return NextResponse.json(
      { error: "Campaign must be active (SENDING) to send emails." },
      { status: 400 },
    );
  }

  const enrollmentCount = await prisma.campaignEnrollment.count({
    where: { campaignId: id, status: "active" },
  });
  if (enrollmentCount === 0) {
    return NextResponse.json(
      { error: "No leads enrolled. Add leads to the campaign first." },
      { status: 400 },
    );
  }

  const requeue = await activateCampaign(id);

  let totalSent = 0;
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // Process up to 5 batches (50 emails max per click)
  for (let i = 0; i < 5; i++) {
    const result = await processSendQueue({
      ignoreSendWindow: true,
      campaignId: id,
    });
    totalSent += result.sent;
    totalProcessed += result.processed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
    if (result.processed === 0) break;
  }

  const queue = await getCampaignQueueStatus(id);
  const failedItems = queue.items.filter((i) => i.status === "failed");
  for (const f of failedItems) {
    if (f.lastError) errors.push(`${f.email}: ${f.lastError}`);
  }

  const scopeHint =
    errors.some((e) =>
      /insufficient authentication scopes|Gmail not authorized|invalid_grant|invalid credentials|unauthorized/i.test(e),
    )
      ? "Reconnect Gmail on the Mailboxes page (Advanced → Continue) to grant send permission."
      : undefined;

  return NextResponse.json({
    requeue,
    sent: totalSent,
    processed: totalProcessed,
    failed: totalFailed,
    skipped: totalSkipped,
    queue,
    errors,
    scopeHint,
    message:
      totalSent > 0
        ? `Sent ${totalSent} email(s). Check the lead inbox (and your Sent folder).`
        : scopeHint
          ? scopeHint
          : totalFailed > 0
            ? "Send failed — see errors below."
            : queue.pendingCount > 0
              ? `Nothing due yet. Next send scheduled: ${queue.nextScheduled}`
              : "No emails to send. Re-activate or add leads.",
  });
}
