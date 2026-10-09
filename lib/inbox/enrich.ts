import { prisma } from "@/lib/prisma";
import type { InboxThreadSummary } from "@/lib/gmail/inbox";

export type InboxThreadTag = {
  label: string;
  tone: "primary" | "success" | "neutral" | "warning";
};

export type EnrichedInboxThread = InboxThreadSummary & {
  isExternal: boolean;
  tags: InboxThreadTag[];
  campaignId?: string;
  campaignName?: string;
  prospectId?: string;
  prospectName?: string;
  enrollmentId?: string;
  enrollmentStatus?: string;
};

export async function enrichInboxThreads(
  ownerUserId: string,
  threads: InboxThreadSummary[],
): Promise<EnrichedInboxThread[]> {
  if (threads.length === 0) return [];

  const threadIds = threads.map((t) => t.threadId);
  const mailboxIds = [...new Set(threads.map((t) => t.mailboxId))];

  const enrollments = await prisma.campaignEnrollment.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      campaign: { ownerUserId },
      gmailThreadId: { in: threadIds },
    },
    include: {
      prospect: true,
      campaign: true,
    },
  });

  const replies = await prisma.replyEvent.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      gmailThreadId: { in: threadIds },
    },
    select: { gmailThreadId: true, enrollmentId: true },
  });

  const enrollmentByThread = new Map(
    enrollments
      .filter((e) => e.gmailThreadId)
      .map((e) => [e.gmailThreadId!, e]),
  );
  const repliedThreads = new Set(
    replies.map((r) => r.gmailThreadId).filter(Boolean) as string[],
  );

  const prospectEmails = new Set(
    enrollments.map((e) => e.prospect.email.toLowerCase()),
  );

  return threads.map((thread) => {
    const enrollment = enrollmentByThread.get(thread.threadId);
    const fromLower = thread.fromEmail.toLowerCase();
    const isFromProspect = prospectEmails.has(fromLower);
    const isExternal = !enrollment && !isFromProspect;

    const tags: InboxThreadTag[] = [];

    if (isExternal) {
      tags.push({ label: "External", tone: "neutral" });
    }

    if (enrollment) {
      tags.push({ label: enrollment.campaign.name, tone: "primary" });
      if (enrollment.status === "replied" || repliedThreads.has(thread.threadId)) {
        tags.push({ label: "Replied", tone: "success" });
      } else if (enrollment.status === "active") {
        tags.push({ label: "In Sequence", tone: "neutral" });
      } else if (enrollment.status === "unsubscribed") {
        tags.push({ label: "Unsubscribed", tone: "warning" });
      }
    }

    if (thread.direction === "sent") {
      tags.unshift({ label: "Sent", tone: "primary" });
    } else if (thread.direction === "received") {
      tags.unshift({ label: "Received", tone: "success" });
    }

    return {
      ...thread,
      isExternal,
      tags,
      campaignId: enrollment?.campaignId,
      campaignName: enrollment?.campaign.name,
      prospectId: enrollment?.prospectId,
      prospectName: enrollment
        ? `${enrollment.prospect.firstName} ${enrollment.prospect.lastName ?? ""}`.trim()
        : undefined,
      enrollmentId: enrollment?.id,
      enrollmentStatus: enrollment?.status,
    };
  });
}
