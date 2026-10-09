import { NextResponse } from "next/server";
import { activateCampaign, enrollProspects } from "@/lib/campaigns/activate";
import { deleteCampaign } from "@/lib/campaigns/delete";
import { getCampaignDetail } from "@/lib/campaigns/detail-query";
import { replaceCampaignSteps } from "@/lib/campaigns/steps";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { campaignUpdateSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await getCampaignDetail(id, user.profile.id);

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = campaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.campaign.findFirst({
      where: { id, ownerUserId: user.profile.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (parsed.data.steps) {
      await replaceCampaignSteps(id, parsed.data.steps);
    }

    if (parsed.data.prospectIds?.length) {
      const mailboxId = parsed.data.mailboxId ?? existing.mailboxId;
      await enrollProspects(id, parsed.data.prospectIds, mailboxId);
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.mailboxId !== undefined) updateData.mailboxId = parsed.data.mailboxId;
    if (parsed.data.timezone !== undefined) updateData.timezone = parsed.data.timezone;
    if (parsed.data.sendWindowStartHour !== undefined) {
      updateData.sendWindowStartHour = parsed.data.sendWindowStartHour;
    }
    if (parsed.data.sendWindowEndHour !== undefined) {
      updateData.sendWindowEndHour = parsed.data.sendWindowEndHour;
    }
    if (parsed.data.status && parsed.data.status !== "active") {
      updateData.status = parsed.data.status;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.campaign.update({ where: { id }, data: updateData });
    }

    if (parsed.data.status === "active") {
      const result = await activateCampaign(id);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    }

    const campaign = await getCampaignDetail(id, user.profile.id);

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await deleteCampaign(id, user.profile.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/campaigns/[id] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
