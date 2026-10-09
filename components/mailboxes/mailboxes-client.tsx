"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectGmailLink } from "@/components/mailboxes/connect-gmail-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface MailboxRow {
  id: string;
  email: string;
  dailySendLimit: number;
  isActive: boolean;
  sentToday: number;
  hasGmailSendScope?: boolean;
  missingScopes?: string[];
}

export function MailboxesClient({ mailboxes }: { mailboxes: MailboxRow[] }) {
  const [limits, setLimits] = useState<Record<string, number>>(
    Object.fromEntries(mailboxes.map((m) => [m.id, m.dailySendLimit])),
  );

  async function saveLimit(id: string) {
    const res = await fetch(`/api/mailboxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailySendLimit: limits[id] }),
    });
    if (res.ok) toast.success("Daily limit updated");
    else toast.error("Failed to update limit");
  }

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        icon="alternate_email"
        title="No mailboxes connected"
        description="Connect your Google Workspace Gmail to start sending outreach emails."
        action={<ConnectGmailLink />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {mailboxes.map((mb) => (
        <div
          key={mb.id}
          className="bg-surface-container-lowest border border-outline-variant p-6 rounded flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="font-bold text-body-lg">{mb.email}</p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Sent today: {mb.sentToday} / {mb.dailySendLimit}
            </p>
            <Badge variant={mb.isActive ? "default" : "secondary"} className="mt-2">
              {mb.isActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
            {mb.hasGmailSendScope === false && (
              <div className="mt-3 p-3 bg-error-container rounded text-body-sm text-on-error-container max-w-md">
                <p className="font-bold">Gmail send not authorized</p>
                <p className="mt-1">
                  Missing: {mb.missingScopes?.join(", ") ?? "gmail.send"}. Reconnect and click
                  Advanced → Continue on Google&apos;s warning, then approve Gmail access.
                </p>
                <ConnectGmailLink className="mt-3 inline-flex text-sm h-9 px-3">
                  Reconnect Gmail
                </ConnectGmailLink>
              </div>
            )}
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <ConnectGmailLink className="h-10 px-4">
              Reconnect Gmail
            </ConnectGmailLink>
            <div className="space-y-1">
              <Label htmlFor={`limit-${mb.id}`}>Daily limit</Label>
              <Input
                id={`limit-${mb.id}`}
                type="number"
                min={1}
                max={500}
                value={limits[mb.id]}
                onChange={(e) =>
                  setLimits((prev) => ({
                    ...prev,
                    [mb.id]: parseInt(e.target.value, 10) || 20,
                  }))
                }
                className="w-24"
              />
            </div>
            <Button variant="secondary" onClick={() => saveLimit(mb.id)}>
              Save
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
