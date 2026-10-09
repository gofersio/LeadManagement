import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { checkMailboxScopesFromStored } from "@/lib/gmail/verify-scopes";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mailboxes = await prisma.gmailMailbox.findMany({
    where: { userId: user.profile.id, isActive: true },
    select: { id: true, email: true, dailySendLimit: true, isActive: true, tokenScope: true },
  });

  const withScopes = mailboxes.map((mb) => {
    const check = checkMailboxScopesFromStored(mb.tokenScope);
    return {
      ...mb,
      hasGmailSendScope: check.ok,
      missingScopes: check.missing,
      tokenScope: check.scope ?? mb.tokenScope,
    };
  });

  return NextResponse.json({ mailboxes: withScopes });
}
