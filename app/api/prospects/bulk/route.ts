import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(["delete", "status"]),
  status: z
    .enum(["new", "contacted", "replied", "unsubscribed", "bounced", "stopped"])
    .optional(),
});

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, action, status } = parsed.data;
  const where = { id: { in: ids }, ownerUserId: user.profile.id };

  if (action === "status") {
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }
    const result = await prisma.prospect.updateMany({ where, data: { status } });
    return NextResponse.json({ updated: result.count });
  }

  const result = await prisma.prospect.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
