import { prisma } from "@/lib/prisma";

export async function duplicateCampaign(campaignId: string, ownerUserId: string) {
  const source = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerUserId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
    },
  });

  if (!source) return { ok: false as const, error: "Not found" };

  const copyName = await uniqueCopyName(source.name, ownerUserId);

  const campaign = await prisma.campaign.create({
    data: {
      name: copyName,
      description: source.description,
      status: "draft",
      mailboxId: source.mailboxId,
      ownerUserId,
      timezone: source.timezone,
      sendWindowStartHour: source.sendWindowStartHour,
      sendWindowEndHour: source.sendWindowEndHour,
      steps: {
        create: source.steps.map((step) => ({
          stepNumber: step.stepNumber,
          delayDays: step.delayDays,
          subject: step.subject,
          body: step.body,
          isActive: step.isActive,
        })),
      },
    },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      mailbox: { select: { email: true } },
    },
  });

  return { ok: true as const, campaign };
}

async function uniqueCopyName(baseName: string, ownerUserId: string): Promise<string> {
  const root = baseName.replace(/\s+\(Copy(?: \d+)?\)$/i, "").trim();
  let candidate = `${root} (Copy)`;
  let n = 2;

  while (
    await prisma.campaign.findFirst({
      where: { ownerUserId, name: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${root} (Copy ${n})`;
    n++;
  }

  return candidate;
}
