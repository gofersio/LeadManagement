import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/validations/prospect";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source")?.trim() || undefined;
  const includeSources = searchParams.get("sources") === "1";
  const picker = searchParams.get("picker") === "1";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    picker ? 2000 : 100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  const where = {
    ownerUserId: user.profile.id,
    ...(status ? { status: status as never } : {}),
    ...(source ? { source } : {}),
  };

  const listSelect = picker
    ? {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
      }
    : {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        title: true,
        source: true,
        status: true,
      };

  const [prospects, total, sourceRows] = await Promise.all([
    prisma.prospect.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.prospect.count({ where }),
    includeSources
      ? prisma.prospect.findMany({
          where: { ownerUserId: user.profile.id },
          distinct: ["source"],
          select: { source: true },
          orderBy: { source: "asc" },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    prospects,
    total,
    page,
    limit,
    ...(sourceRows
      ? { sources: sourceRows.map((row) => row.source).filter(Boolean) }
      : {}),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = prospectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const suppressed = await prisma.suppressionList.findUnique({ where: { email } });
  if (suppressed) {
    return NextResponse.json(
      { error: "This email is on the suppression list" },
      { status: 400 },
    );
  }

  try {
    const prospect = await prisma.prospect.create({
      data: {
        ...parsed.data,
        email,
        linkedInUrl: parsed.data.linkedInUrl || null,
        ownerUserId: user.profile.id,
      },
    });
    return NextResponse.json(prospect, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Prospect already exists" }, { status: 409 });
  }
}
