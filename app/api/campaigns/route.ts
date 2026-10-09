import { NextResponse } from "next/server";
import { getCampaignsForList } from "@/lib/campaigns/list-query";
import { enrollProspects } from "@/lib/campaigns/activate";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { campaignCreateSchema } from "@/lib/validations/campaign";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await getCampaignsForList(user.profile.id);
    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("GET /api/campaigns failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load campaigns" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mailbox = await prisma.gmailMailbox.findFirst({
    where: { id: parsed.data.mailboxId, userId: user.profile.id },
  });
  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      mailboxId: parsed.data.mailboxId,
      ownerUserId: user.profile.id,
      timezone: parsed.data.timezone,
      sendWindowStartHour: parsed.data.sendWindowStartHour,
      sendWindowEndHour: parsed.data.sendWindowEndHour,
      steps: {
        create: parsed.data.steps,
      },
    },
    include: { steps: true },
  });

  if (parsed.data.prospectIds?.length) {
    await enrollProspects(campaign.id, parsed.data.prospectIds, mailbox.id);
  }

  return NextResponse.json(campaign, { status: 201 });
}
