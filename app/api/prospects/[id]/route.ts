import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { prospectUpdateSchema } from "@/lib/validations/prospect";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { id, ownerUserId: user.profile.id },
  });

  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prospect);
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = prospectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.prospect.findFirst({
    where: { id, ownerUserId: user.profile.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prospect = await prisma.prospect.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.email ? { email: parsed.data.email.toLowerCase() } : {}),
      linkedInUrl: parsed.data.linkedInUrl === "" ? null : parsed.data.linkedInUrl,
    },
  });

  return NextResponse.json(prospect);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.prospect.findFirst({
    where: { id, ownerUserId: user.profile.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.prospect.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
