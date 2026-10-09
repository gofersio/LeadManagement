import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { getThreadDetail, markThreadAsRead } from "@/lib/gmail/inbox";
import {
  loadLocalMessagesForThread,
  mergeThreadMessages,
} from "@/lib/inbox/campaign-emails";
import { sendGmailMessage } from "@/lib/gmail/send";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const replySchema = z.object({
  mailboxId: z.string(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string(),
  inReplyToMessageId: z.string().optional().nullable(),
  references: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get("mailboxId");

  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId required" }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: mailboxId, userId: user.profile.id },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const detail = await getThreadDetail(mailboxId, mailbox.email, threadId);
    const localMessages = await loadLocalMessagesForThread(
      mailboxId,
      threadId,
      mailbox.email,
      user.profile.id,
    );
    const messages = mergeThreadMessages(detail.messages, localMessages);

    await markThreadAsRead(mailboxId, threadId).catch(() => undefined);

    const enrollment = await prisma.campaignEnrollment.findFirst({
      where: {
        gmailThreadId: threadId,
        mailboxId,
        campaign: { ownerUserId: user.profile.id },
      },
      include: { prospect: true, campaign: true },
    });

    return NextResponse.json({
      ...detail,
      messages,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            campaignId: enrollment.campaignId,
            campaignName: enrollment.campaign.name,
            prospectId: enrollment.prospectId,
            prospectName: `${enrollment.prospect.firstName} ${enrollment.prospect.lastName ?? ""}`.trim(),
            prospectEmail: enrollment.prospect.email,
            status: enrollment.status,
          }
        : null,
    });
  } catch (err) {
    console.error("GET thread failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load thread" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const body = await request.json();
  const parsed = replySchema.safeParse({ ...body, threadId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: parsed.data.mailboxId, userId: user.profile.id },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const result = await sendGmailMessage({
      mailboxId: parsed.data.mailboxId,
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      threadId: parsed.data.threadId,
      inReplyToMessageId: parsed.data.inReplyToMessageId,
      references: parsed.data.references,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Reply send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send reply" },
      { status: 500 },
    );
  }
}
