import { addHours } from "date-fns";
import { renderSubject, renderTemplate } from "@/lib/email/render-template";
import {
  alignToSendWindow,
  campaignScheduleFromCampaign,
  computeScheduledFor,
  getNextDailySendSlot,
  zonedLocalToUtc,
} from "@/lib/campaigns/schedule";
import { getLastOutboundMessageId } from "@/lib/gmail/threads";
import { sendGmailMessage } from "@/lib/gmail/send";
import { isGmailAuthenticationError } from "@/lib/gmail/verify-scopes";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 10;

async function isSuppressed(email: string): Promise<boolean> {
  const entry = await prisma.suppressionList.findUnique({
    where: { email: email.toLowerCase() },
  });
  return !!entry;
}

async function getTodaySendCount(
  mailboxId: string,
  timezone: string,
): Promise<number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const dayStart = zonedLocalToUtc(year, month, day, 0, 0, timezone);

  return prisma.emailMessage.count({
    where: {
      mailboxId,
      status: "sent",
      sentAt: { gte: dayStart },
    },
  });
}

export async function processSendQueue(options?: {
  ignoreSendWindow?: boolean;
  campaignId?: string;
}): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const now = new Date();
  const items = await prisma.sendQueue.findMany({
    where: {
      status: "pending",
      scheduledFor: { lte: now },
      ...(options?.campaignId
        ? { enrollment: { campaignId: options.campaignId } }
        : {}),
    },
    take: BATCH_SIZE,
    orderBy: { scheduledFor: "asc" },
    include: {
      enrollment: {
        include: {
          campaign: true,
          prospect: true,
        },
      },
      step: true,
      mailbox: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    await prisma.sendQueue.update({
      where: { id: item.id },
      data: { status: "processing" },
    });

    const enrollment = item.enrollment;
    const step = item.step;
    const mailbox = item.mailbox;
    const campaign = enrollment.campaign;
    const prospect = enrollment.prospect;

    const shouldCancel =
      enrollment.status !== "active" ||
      campaign.status !== "active" ||
      !mailbox.isActive ||
      !step.isActive ||
      (await isSuppressed(prospect.email));

    if (shouldCancel) {
      await prisma.sendQueue.update({
        where: { id: item.id },
        data: { status: "cancelled" },
      });
      skipped++;
      continue;
    }

    const scheduleConfig = campaignScheduleFromCampaign(campaign);

    if (!options?.ignoreSendWindow) {
      const windowStart = alignToSendWindow(
        now,
        scheduleConfig.timezone,
        scheduleConfig.sendWindowStartHour,
        scheduleConfig.sendWindowEndHour,
      );
      if (windowStart.getTime() > now.getTime()) {
        await prisma.sendQueue.update({
          where: { id: item.id },
          data: { status: "pending", scheduledFor: windowStart },
        });
        skipped++;
        continue;
      }
    }

    const todayCount = await getTodaySendCount(mailbox.id, scheduleConfig.timezone);
    if (todayCount >= mailbox.dailySendLimit) {
      const nextSlot = getNextDailySendSlot(new Date(), scheduleConfig);
      await prisma.sendQueue.update({
        where: { id: item.id },
        data: { status: "pending", scheduledFor: nextSlot },
      });
      skipped++;
      continue;
    }

    const subject = renderSubject(step.subject, prospect);
    const body = renderTemplate(step.body, prospect);

    try {
      let threadId = enrollment.gmailThreadId;
      let inReplyTo: string | null = null;
      let references: string | null = null;

      if (threadId && enrollment.currentStep > 0) {
        const prior = await getLastOutboundMessageId(
          mailbox.id,
          threadId,
          mailbox.email,
        );
        inReplyTo = prior.messageIdHeader;
        references = prior.messageIdHeader;
      }

      const result = await sendGmailMessage({
        mailboxId: mailbox.id,
        to: prospect.email,
        subject,
        body,
        threadId,
        inReplyToMessageId: inReplyTo,
        references,
      });

      await prisma.emailMessage.create({
        data: {
          enrollmentId: enrollment.id,
          stepId: step.id,
          mailboxId: mailbox.id,
          gmailMessageId: result.messageId,
          gmailThreadId: result.threadId,
          toEmail: prospect.email,
          subject,
          bodyRendered: body,
          status: "sent",
          sentAt: new Date(),
        },
      });

      await prisma.sendQueue.update({
        where: { id: item.id },
        data: { status: "sent" },
      });

      const nextStep = await prisma.campaignStep.findFirst({
        where: {
          campaignId: campaign.id,
          stepNumber: step.stepNumber + 1,
          isActive: true,
        },
      });

      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: step.stepNumber,
          gmailThreadId: result.threadId ?? threadId,
          lastSentAt: new Date(),
          ...(nextStep
            ? {}
            : { status: "completed", stoppedAt: new Date(), stopReason: "sequence_complete" }),
        },
      });

      if (nextStep) {
        await prisma.sendQueue.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: nextStep.id,
            mailboxId: mailbox.id,
            scheduledFor: computeScheduledFor(new Date(), nextStep.delayDays, scheduleConfig),
            status: "pending",
          },
        });
      }

      if (enrollment.prospect.status === "new") {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { status: "contacted" },
        });
      }

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      const attempts = item.attempts + 1;
      const authenticationError = isGmailAuthenticationError(message);

      if (authenticationError || attempts >= 3) {
        await prisma.sendQueue.update({
          where: { id: item.id },
          data: { status: "failed", attempts, lastError: message },
        });
        // A revoked or expired Google token is recoverable by reconnecting the
        // mailbox. Keep the lead active so a later manual send can enqueue it
        // again; only stop the lead after a non-authentication failure exhausts
        // its retries.
        if (!authenticationError) {
          await prisma.campaignEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: "stopped",
              stoppedAt: new Date(),
              stopReason: message,
            },
          });
        }
        failed++;
      } else {
        await prisma.sendQueue.update({
          where: { id: item.id },
          data: {
            status: "pending",
            attempts,
            lastError: message,
            scheduledFor: addHours(new Date(), 1),
          },
        });
      }
    }
  }

  return { processed: items.length, sent, skipped, failed };
}
