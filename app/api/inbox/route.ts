import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import {
  listAllMailboxThreads,
  listMailboxThreads,
  listScheduledSends,
  listUserMailboxes,
} from "@/lib/gmail/inbox";
import { listCampaignSentThreads } from "@/lib/inbox/campaign-emails";
import { enrichInboxThreads } from "@/lib/inbox/enrich";

type InboxTab = "all" | "unread" | "sent" | "received" | "scheduled" | "draft";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") ?? "all") as InboxTab;
  const query = searchParams.get("q") ?? undefined;
  const mailboxId = searchParams.get("mailboxId") ?? undefined;

  const mailboxes = await listUserMailboxes(user.profile.id);
  if (mailboxes.length === 0) {
    return NextResponse.json({
      threads: [],
      scheduled: [],
      mailboxes: [],
      error: "no_mailbox",
    });
  }

  const targets = mailboxId
    ? mailboxes.filter((m) => m.id === mailboxId)
    : mailboxes;

  if (targets.length === 0) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  if (tab === "scheduled") {
    const scheduled = await listScheduledSends(user.profile.id);
    return NextResponse.json({
      threads: [],
      scheduled,
      mailboxes,
    });
  }

  const threadBatches = await Promise.all(
    targets.map(async (mb) => {
      try {
        if (tab === "all") {
          return listAllMailboxThreads(mb.id, mb.email, { query });
        }
        if (tab === "sent") {
          const [gmailSent, campaignSent] = await Promise.all([
            listMailboxThreads(mb.id, mb.email, { tab: "sent", query }),
            listCampaignSentThreads(user.profile.id, mb.id),
          ]);
          const byThread = new Map<string, (typeof gmailSent)[0]>();
          for (const t of [...gmailSent, ...campaignSent]) {
            if (!byThread.has(t.threadId)) byThread.set(t.threadId, t);
          }
          return [...byThread.values()];
        }
        return listMailboxThreads(mb.id, mb.email, { tab, query });
      } catch (err) {
        console.error(`Inbox list failed for ${mb.email}:`, err);
        return [];
      }
    }),
  );

  const merged = threadBatches
    .flat()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const deduped = dedupeThreads(merged);
  const threads = await enrichInboxThreads(user.profile.id, deduped);

  return NextResponse.json({
    threads,
    scheduled: [],
    mailboxes,
    total: threads.length,
  });
}

function dedupeThreads<T extends { threadId: string; mailboxId: string; date: string }>(
  threads: T[],
): T[] {
  const map = new Map<string, T>();
  for (const t of threads) {
    const key = `${t.mailboxId}:${t.threadId}`;
    const existing = map.get(key);
    if (!existing || new Date(t.date) > new Date(existing.date)) {
      map.set(key, t);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
