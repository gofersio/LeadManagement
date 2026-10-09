import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { fetchGmailAttachment } from "@/lib/gmail/inbox";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get("mailboxId");
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");

  if (!mailboxId || !messageId || !attachmentId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: mailboxId, userId: user.profile.id },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const { data, mimeType } = await fetchGmailAttachment(
      mailboxId,
      messageId,
      attachmentId,
    );

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Attachment fetch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load attachment" },
      { status: 500 },
    );
  }
}
