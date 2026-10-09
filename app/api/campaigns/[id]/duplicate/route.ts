import { NextResponse } from "next/server";
import { duplicateCampaign } from "@/lib/campaigns/duplicate";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await duplicateCampaign(id, user.profile.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns/[id]/duplicate failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
