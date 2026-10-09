"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InboxTab = "all" | "unread" | "sent" | "received" | "scheduled" | "draft";

type Mailbox = { id: string; email: string };

type InboxThreadTag = {
  label: string;
  tone: "primary" | "success" | "neutral" | "warning";
};

type InboxThread = {
  threadId: string;
  mailboxId: string;
  mailboxEmail: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messageCount: number;
  isExternal: boolean;
  tags: InboxThreadTag[];
  campaignId?: string;
  campaignName?: string;
  prospectName?: string;
  direction?: "sent" | "received" | "mixed";
  toName?: string;
  toEmail?: string;
};

type ScheduledItem = {
  id: string;
  mailboxId: string;
  scheduledFor: string;
  prospectName: string;
  prospectEmail: string;
  campaignName: string;
  campaignId: string;
  stepNumber: number;
  status: string;
  subject: string;
};

type InboxMessage = {
  id: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  subject: string;
  date: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  messageIdHeader: string | null;
  isOutbound: boolean;
  source?: "gmail" | "campaign" | "reply";
};

type ThreadDetail = {
  threadId: string;
  mailboxId: string;
  mailboxEmail: string;
  subject: string;
  messages: InboxMessage[];
  enrollment?: {
    id: string;
    campaignId: string;
    campaignName: string;
    prospectName: string;
    prospectEmail: string;
    status: string;
  } | null;
};

const TABS: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
  { id: "unread", label: "Unread" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Draft" },
];

export function UnifiedInbox() {
  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [mailboxId, setMailboxId] = useState<string>("");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noMailbox, setNoMailbox] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab });
    if (search) params.set("q", search);
    if (mailboxId) params.set("mailboxId", mailboxId);

    const res = await fetch(`/api/inbox?${params}`);
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to load inbox");
      return;
    }

    setNoMailbox(data.error === "no_mailbox");
    setMailboxes(data.mailboxes ?? []);
    setThreads(data.threads ?? []);
    setScheduled(data.scheduled ?? []);

    if (!mailboxId && data.mailboxes?.[0]?.id) {
      setMailboxId(data.mailboxes[0].id);
    }
  }, [tab, search, mailboxId]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const loadThread = useCallback(async (threadId: string, mbId: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/inbox/threads/${threadId}?mailboxId=${mbId}`);
    const data = await res.json();
    setDetailLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to load conversation");
      return;
    }

    setDetail(data);
    setThreads((prev) =>
      prev.map((t) =>
        t.threadId === threadId ? { ...t, isUnread: false } : t,
      ),
    );
  }, []);

  useEffect(() => {
    if (selectedThreadId && selectedMailboxId) {
      loadThread(selectedThreadId, selectedMailboxId);
    } else {
      setDetail(null);
    }
  }, [selectedThreadId, selectedMailboxId, loadThread]);

  function selectThread(thread: InboxThread) {
    setSelectedThreadId(thread.threadId);
    setSelectedMailboxId(thread.mailboxId);
    setReplyOpen(false);
    setReplyBody("");
  }

  const replyTarget = useMemo(() => {
    if (!detail?.messages.length) return null;
    const inbound = [...detail.messages].reverse().find((m) => !m.isOutbound);
    return inbound ?? detail.messages[detail.messages.length - 1]!;
  }, [detail]);

  async function handleSendReply() {
    if (!detail || !replyTarget || !replyBody.trim()) return;

    setSendingReply(true);
    const subject = detail.subject.startsWith("Re:")
      ? detail.subject
      : `Re: ${detail.subject}`;

    const toEmail =
      detail.enrollment?.prospectEmail ??
      (replyTarget.isOutbound ? replyTarget.to[0] : replyTarget.fromEmail);

    const res = await fetch(`/api/inbox/threads/${detail.threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId: detail.mailboxId,
        threadId: detail.threadId,
        to: toEmail,
        subject,
        body: replyBody,
        inReplyToMessageId: replyTarget.messageIdHeader,
        references: replyTarget.messageIdHeader,
      }),
    });
    setSendingReply(false);

    if (res.ok) {
      toast.success("Reply sent");
      setReplyOpen(false);
      setReplyBody("");
      loadThread(detail.threadId, detail.mailboxId);
      loadInbox();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to send reply");
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  if (noMailbox) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <Icon name="mail" size={48} className="text-on-surface-variant/40 mb-4" />
        <h2 className="text-headline-sm font-semibold mb-2">Connect Gmail to use Unified Inbox</h2>
        <p className="text-body-sm text-on-surface-variant mb-6 max-w-md">
          Link your sending mailbox to read and reply to conversations from one place.
        </p>
        <Link href="/dashboard/mailboxes">
          <Button>Connect Mailbox</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface">
      <div className="flex items-center justify-between px-6 py-3 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <h1 className="text-[18px] font-semibold text-on-surface">Unified Inbox</h1>
        <div className="flex items-center gap-2">
          {mailboxes.length > 1 && (
            <select
              value={mailboxId}
              onChange={(e) => {
                setMailboxId(e.target.value);
                setSelectedThreadId(null);
              }}
              className="h-8 rounded border border-outline-variant bg-surface-container-low px-2 text-[12px]"
            >
              <option value="">All mailboxes</option>
              {mailboxes.map((mb) => (
                <option key={mb.id} value={mb.id}>
                  {mb.email}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={loadInbox}
            className="p-2 rounded hover:bg-surface-container-high text-on-surface-variant"
            title="Refresh"
          >
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-full max-w-[400px] shrink-0 border-r border-outline-variant flex flex-col bg-surface-container-lowest">
          <div className="px-4 pt-3 border-b border-outline-variant">
            <nav className="flex gap-4 mb-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setSelectedThreadId(null);
                  }}
                  className={cn(
                    "text-[13px] pb-2 border-b-2 -mb-px transition-colors",
                    tab === t.id
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {tab !== "scheduled" && (
              <form onSubmit={handleSearchSubmit} className="relative mb-3">
                <Icon
                  name="search"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search Conversation"
                  className="pl-9 h-9 text-[13px]"
                />
              </form>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-body-sm text-on-surface-variant">Loading...</p>
            ) : tab === "scheduled" ? (
              <ScheduledList
                items={scheduled}
                selectedId={selectedThreadId}
                onSelect={(item) => {
                  setSelectedThreadId(item.id);
                  setSelectedMailboxId(item.mailboxId);
                  setDetail(null);
                }}
              />
            ) : threads.length === 0 ? (
              <p className="p-6 text-body-sm text-on-surface-variant">
                {tab === "draft" ? "No drafts." : "No conversations found."}
              </p>
            ) : (
              threads.map((thread) => (
                <ThreadListItem
                  key={`${thread.mailboxId}-${thread.threadId}`}
                  thread={thread}
                  active={
                    selectedThreadId === thread.threadId &&
                    selectedMailboxId === thread.mailboxId
                  }
                  onClick={() => selectThread(thread)}
                />
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-outline-variant text-[11px] text-on-surface-variant">
            {tab === "scheduled"
              ? `${scheduled.length} scheduled`
              : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-surface">
          {tab === "scheduled" && selectedThreadId ? (
            <ScheduledDetail
              item={scheduled.find((s) => s.id === selectedThreadId) ?? null}
            />
          ) : selectedThreadId && selectedMailboxId ? (
            <ThreadDetailPane
              detail={detail}
              loading={detailLoading}
              replyOpen={replyOpen}
              replyBody={replyBody}
              sendingReply={sendingReply}
              onReplyOpen={() => setReplyOpen(true)}
              onReplyClose={() => setReplyOpen(false)}
              onReplyBodyChange={setReplyBody}
              onSendReply={handleSendReply}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-on-surface-variant">
              <div className="text-center">
                <Icon name="mail" size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-body-md">Select a conversation to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadListItem({
  thread,
  active,
  onClick,
}: {
  thread: InboxThread;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-outline-variant/60 hover:bg-surface-container-low transition-colors",
        active && "bg-primary/5 border-l-2 border-l-primary",
        thread.isUnread && !active && "bg-surface-container-low/50",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p
          className={cn(
            "text-[13px] truncate",
            thread.isUnread ? "font-bold text-on-surface" : "font-medium text-on-surface",
          )}
        >
          {thread.direction === "sent"
            ? `To: ${thread.toName ?? thread.prospectName ?? thread.toEmail ?? "Recipient"}`
            : thread.fromName}
        </p>
        <span className="text-[11px] text-on-surface-variant shrink-0">
          {formatThreadDate(thread.date)}
        </span>
      </div>
      <p
        className={cn(
          "text-[12px] truncate mb-1",
          thread.isUnread ? "font-semibold text-on-surface" : "text-on-surface",
        )}
      >
        {thread.subject}
      </p>
      <p className="text-[11px] text-on-surface-variant line-clamp-2 mb-2">
        {thread.snippet}
      </p>
      <div className="flex flex-wrap gap-1">
        {thread.tags.map((tag) => (
          <ThreadTag key={tag.label} tag={tag} />
        ))}
      </div>
    </button>
  );
}

function ThreadTag({ tag }: { tag: InboxThreadTag }) {
  return (
    <span
      className={cn(
        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
        tag.tone === "primary" && "bg-primary/10 text-primary",
        tag.tone === "success" && "bg-tertiary-container text-on-tertiary-container",
        tag.tone === "warning" && "bg-error-container/50 text-error",
        tag.tone === "neutral" && "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {tag.label}
    </span>
  );
}

function ThreadDetailPane({
  detail,
  loading,
  replyOpen,
  replyBody,
  sendingReply,
  onReplyOpen,
  onReplyClose,
  onReplyBodyChange,
  onSendReply,
}: {
  detail: ThreadDetail | null;
  loading: boolean;
  replyOpen: boolean;
  replyBody: string;
  sendingReply: boolean;
  onReplyOpen: () => void;
  onReplyClose: () => void;
  onReplyBodyChange: (v: string) => void;
  onSendReply: () => void;
}) {
  if (loading || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-on-surface-variant">
        Loading conversation...
      </div>
    );
  }

  const latest = detail.messages[detail.messages.length - 1];

  return (
    <>
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-on-surface truncate">
              {detail.subject}
            </h2>
            {detail.enrollment && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <ThreadTag tag={{ label: detail.enrollment.campaignName, tone: "primary" }} />
                <Link
                  href={`/dashboard/campaigns/${detail.enrollment.campaignId}`}
                  className="text-[11px] text-primary hover:underline"
                >
                  View sequence
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onReplyOpen}
              className="inline-flex items-center gap-1 h-8 px-3 rounded border border-outline-variant text-[12px] hover:bg-surface-container-low"
            >
              <Icon name="reply" size={16} />
              Reply
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {detail.messages.map((msg) => (
          <MessageBlock key={msg.id} message={msg} mailboxEmail={detail.mailboxEmail} />
        ))}
      </div>

      {replyOpen && latest && (
        <div className="border-t border-outline-variant bg-surface-container-lowest p-4 shrink-0">
          <p className="text-[12px] text-on-surface-variant mb-2">
            Reply to {latest.fromName} &lt;{latest.fromEmail}&gt;
          </p>
          <Textarea
            value={replyBody}
            onChange={(e) => onReplyBodyChange(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="mb-3"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onReplyClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSendReply}
              disabled={sendingReply || !replyBody.trim()}
              className="text-white"
            >
              {sendingReply ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBlock({
  message,
  mailboxEmail,
}: {
  message: InboxMessage;
  mailboxEmail: string;
}) {
  const isMine = message.isOutbound || message.fromEmail.toLowerCase() === mailboxEmail.toLowerCase();

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isMine ? "border-primary/20 bg-primary/5" : "border-outline-variant bg-surface-container-lowest",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-on-surface">
              {message.fromName}
              <span className="font-normal text-on-surface-variant ml-1">
                &lt;{message.fromEmail}&gt;
              </span>
            </p>
            {message.source === "campaign" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                Sequence sent
              </span>
            )}
            {message.source === "reply" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container font-medium">
                Reply received
              </span>
            )}
            {isMine && message.source !== "campaign" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                Sent
              </span>
            )}
            {!isMine && message.source !== "reply" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary-container/50 text-on-surface font-medium">
                Received
              </span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            To: {message.to.join(", ") || mailboxEmail}
          </p>
        </div>
        <time className="text-[11px] text-on-surface-variant shrink-0">
          {format(new Date(message.date), "MMM d, yyyy hh:mm a")}
        </time>
      </div>
      {message.bodyHtml ? (
        <div
          className="email-body text-body-sm text-on-surface max-w-none"
          dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
        />
      ) : (
        <div className="text-body-sm text-on-surface whitespace-pre-wrap">
          {message.bodyText ?? message.snippet}
        </div>
      )}
    </div>
  );
}

function ScheduledList({
  items,
  selectedId,
  onSelect,
}: {
  items: ScheduledItem[];
  selectedId: string | null;
  onSelect: (item: ScheduledItem) => void;
}) {
  if (items.length === 0) {
    return <p className="p-6 text-body-sm text-on-surface-variant">No scheduled emails.</p>;
  }

  return items.map((item) => (
    <button
      key={item.id}
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-outline-variant/60 hover:bg-surface-container-low",
        selectedId === item.id && "bg-primary/5 border-l-2 border-l-primary",
      )}
    >
      <div className="flex justify-between gap-2 mb-1">
        <p className="text-[13px] font-medium truncate">{item.prospectName}</p>
        <span className="text-[11px] text-on-surface-variant shrink-0">
          {format(new Date(item.scheduledFor), "MMM d")}
        </span>
      </div>
      <p className="text-[12px] truncate text-on-surface">{item.subject}</p>
      <p className="text-[11px] text-on-surface-variant mt-1">
        Step {item.stepNumber} · {item.campaignName}
      </p>
    </button>
  ));
}

function ScheduledDetail({ item }: { item: ScheduledItem | null }) {
  if (!item) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-outline-variant">
        <h2 className="text-[16px] font-semibold">{item.subject}</h2>
        <p className="text-[12px] text-on-surface-variant mt-1">
          Scheduled for {format(new Date(item.scheduledFor), "MMM d, yyyy hh:mm a")}
        </p>
      </div>
      <div className="p-6 space-y-4">
        <DetailRow label="Prospect" value={`${item.prospectName} (${item.prospectEmail})`} />
        <DetailRow label="Campaign" value={item.campaignName} />
        <DetailRow label="Step" value={`Step ${item.stepNumber}`} />
        <DetailRow label="Status" value={item.status} />
        <Link
          href={`/dashboard/campaigns/${item.campaignId}`}
          className="inline-flex items-center gap-1 text-primary text-[13px] hover:underline"
        >
          Open sequence
          <Icon name="open_in_new" size={14} />
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="text-body-sm text-on-surface mt-0.5">{value}</p>
    </div>
  );
}

function formatThreadDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return formatDistanceToNow(date, { addSuffix: false });
  if (diffDays < 7) return format(date, "EEE");
  return format(date, "MMM do");
}
