"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StepEditor } from "@/components/campaigns/step-editor";
import {
  CampaignScheduleFields,
  defaultCampaignSchedule,
  type CampaignScheduleValues,
} from "@/components/campaigns/campaign-schedule-fields";
import type { GmailMailbox, Prospect } from "@prisma/client";

interface Step {
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  isActive: boolean;
}

interface CampaignFormProps {
  mailboxes: GmailMailbox[];
  prospects: Prospect[];
  onSubmit: (data: {
    name: string;
    description?: string;
    mailboxId: string;
    prospectIds: string[];
    steps: Step[];
  } & CampaignScheduleValues) => void;
  initial?: {
    name?: string;
    description?: string;
    mailboxId?: string;
  };
}

export function CampaignForm({
  mailboxes,
  prospects,
  onSubmit,
  initial,
}: CampaignFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [mailboxId, setMailboxId] = useState(initial?.mailboxId ?? mailboxes[0]?.id ?? "");
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([
    {
      stepNumber: 1,
      delayDays: 0,
      subject: "Quick question, {{first_name}}",
      body: "Hi {{first_name}},\n\nI noticed you work at {{company}} as {{title}}. Would love to connect.\n\nBest,",
      isActive: true,
    },
  ]);
  const [schedule, setSchedule] = useState<CampaignScheduleValues>(defaultCampaignSchedule());

  // Mailboxes load async from API — sync default selection when they arrive
  useEffect(() => {
    if (mailboxes.length > 0 && !mailboxId) {
      setMailboxId(mailboxes[0].id);
    }
  }, [mailboxes, mailboxId]);

  const canSubmit =
    name.trim().length > 0 &&
    !!mailboxId &&
    steps.length > 0 &&
    steps.some((s) => s.isActive && s.subject.trim() && s.body.trim());

  function toggleProspect(id: string) {
    setSelectedProspects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, description, mailboxId, prospectIds: selectedProspects, steps, ...schedule });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded space-y-4">
        <h3 className="text-headline-sm">Campaign Details</h3>
        <div className="space-y-2">
          <Label htmlFor="name">Campaign Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mailbox">Sending Mailbox</Label>
          <select
            id="mailbox"
            value={mailboxId}
            onChange={(e) => setMailboxId(e.target.value)}
            className="flex h-10 w-full rounded border border-outline-variant bg-surface-container-low px-3 text-body-md"
            required
          >
            {mailboxes.length === 0 ? (
              <option value="">No mailboxes — connect Gmail first</option>
            ) : (
              mailboxes.map((mb) => (
                <option key={mb.id} value={mb.id}>
                  {mb.email}
                </option>
              ))
            )}
          </select>
          {mailboxes.length === 0 && (
            <p className="text-body-sm text-error">
              Connect a Gmail mailbox on the{" "}
              <a href="/dashboard/mailboxes" className="underline text-primary">
                Mailboxes
              </a>{" "}
              page before creating a campaign.
            </p>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded space-y-4">
        <h3 className="text-headline-sm">Schedule &amp; Targeting</h3>
        <CampaignScheduleFields values={schedule} onChange={setSchedule} />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded">
        <StepEditor
          steps={steps}
          onChange={setSteps}
          mailboxId={mailboxId}
          mailboxEmail={mailboxes.find((m) => m.id === mailboxId)?.email}
          previewProspects={prospects
            .filter((p) => selectedProspects.includes(p.id))
            .map((p) => ({
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              company: p.company,
              title: p.title,
            }))}
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded space-y-4">
        <h3 className="text-headline-sm">Add Leads</h3>
        <p className="text-body-sm text-on-surface-variant">
          Select prospects to enroll in this campaign.
        </p>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {prospects.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No leads available.</p>
          ) : (
            prospects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-surface-container-low cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedProspects.includes(p.id)}
                  onChange={() => toggleProspect(p.id)}
                />
                <span className="text-body-md">
                  {p.firstName} {p.lastName} — {p.email}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <Button type="submit" disabled={!canSubmit}>
        Create Campaign
      </Button>
      {!canSubmit && (
        <p className="text-body-sm text-on-surface-variant">
          {!mailboxId
            ? "Connect and select a sending mailbox to enable this button."
            : !name.trim()
              ? "Enter a campaign name."
              : "Add at least one active sequence step with subject and body."}
        </p>
      )}
    </form>
  );
}
