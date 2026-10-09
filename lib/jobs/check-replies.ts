import { containsUnsubscribe } from "@/lib/email/render-template";
import { findReplyFromProspect } from "@/lib/gmail/threads";
import { prisma } from "@/lib/prisma";

export async function checkReplies(): Promise<{
  checked: number;
  repliesFound: number;
}> {
  const mailboxes = await prisma.gmailMailbox.findMany({
    where: { isActive: true },
    include: {
      user: true,
    },
  });

  let checked = 0;
  let repliesFound = 0;

  for (const mailbox of mailboxes) {
    const enrollments = await prisma.campaignEnrollment.findMany({
      where: {
        mailboxId: mailbox.id,
        status: "active",
      },
      include: {
        prospect: true,
        campaign: true,
      },
    });

    for (const enrollment of enrollments) {
      checked++;
      const reply = await findReplyFromProspect(
        mailbox.id,
        mailbox.email,
        enrollment.gmailThreadId,
        enrollment.prospect.email,
      );

      if (!reply) continue;

      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "replied",
          repliedAt: new Date(),
        },
      });

      await prisma.sendQueue.updateMany({
        where: {
          enrollmentId: enrollment.id,
          status: "pending",
        },
        data: { status: "cancelled" },
      });

      await prisma.replyEvent.create({
        data: {
          enrollmentId: enrollment.id,
          mailboxId: mailbox.id,
          gmailMessageId: reply.messageId,
          gmailThreadId: reply.threadId,
          fromEmail: enrollment.prospect.email,
          snippet: reply.snippet,
        },
      });

      await prisma.prospect.update({
        where: { id: enrollment.prospectId },
        data: { status: "replied" },
      });

      await prisma.appNotification.create({
        data: {
          userId: enrollment.campaign.ownerUserId,
          type: "reply",
          title: "New reply received",
          body: `${enrollment.prospect.firstName} ${enrollment.prospect.lastName} replied to "${enrollment.campaign.name}"`,
          metadata: {
            enrollmentId: enrollment.id,
            campaignId: enrollment.campaignId,
            prospectId: enrollment.prospectId,
          },
        },
      });

      if (containsUnsubscribe(reply.snippet)) {
        const email = enrollment.prospect.email.toLowerCase();
        await prisma.suppressionList.upsert({
          where: { email },
          create: {
            email,
            reason: "unsubscribe_reply",
            source: "reply_detection",
            createdByUserId: mailbox.userId,
          },
          update: { reason: "unsubscribe_reply" },
        });
        await prisma.campaignEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "unsubscribed", stopReason: "unsubscribe" },
        });
      }

      repliesFound++;
    }
  }

  return { checked, repliesFound };
}
