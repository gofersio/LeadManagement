import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/validations/prospect";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where = {
    ownerUserId: user.profile.id,
    ...(status ? { status: status as never } : {}),
  };

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.prospect.count({ where }),
  ]);

  return NextResponse.json({ prospects, total, page, limit });
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
