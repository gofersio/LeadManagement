import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { processSendQueue } from "@/lib/jobs/process-send-queue";

export async function POST(request: Request) {
  if (!verifyCronSecret(request as never)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processSendQueue();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
