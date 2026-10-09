import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { sendGmailMessage } from "@/lib/gmail/send";
import { renderSubject, renderTemplate } from "@/lib/email/render-template";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  mailboxId: z.string(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  prospect: z
    .object({
      firstName: z.string(),
      lastName: z.string().optional().nullable(),
      company: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: parsed.data.mailboxId, userId: user.profile.id },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const prospect = parsed.data.prospect ?? {
    firstName: "Test",
    company: "Test Co",
    title: "CEO",
  };

  const subject = renderSubject(parsed.data.subject, prospect);
  const rendered = renderTemplate(parsed.data.body, prospect);

  const result = await sendGmailMessage({
    mailboxId: mailbox.id,
    to: parsed.data.to,
    subject,
    body: rendered,
  });

  return NextResponse.json(result);
}
