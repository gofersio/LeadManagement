import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  reason: z.string().optional(),
  source: z.string().optional(),
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.suppressionList.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const entry = await prisma.suppressionList.upsert({
    where: { email },
    create: {
      email,
      reason: parsed.data.reason,
      source: parsed.data.source ?? "manual",
      createdByUserId: user.profile.id,
    },
    update: {
      reason: parsed.data.reason,
      source: parsed.data.source,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
