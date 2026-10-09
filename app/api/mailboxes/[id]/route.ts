import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  dailySendLimit: z.number().int().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id, userId: user.profile.id },
  });
  if (!mailbox) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.gmailMailbox.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
