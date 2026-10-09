"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CampaignDetailStepper,
  type CampaignDetailTabId,
} from "@/components/campaigns/campaign-detail-stepper";
import {
  CampaignSequenceTimeline,
  createNewStepDraft,
} from "@/components/campaigns/campaign-sequence-timeline";
import { CampaignProspectsTab } from "@/components/campaigns/campaign-prospects-tab";
import { CampaignEmailsTab } from "@/components/campaigns/campaign-emails-tab";
import {
  CampaignScheduleFields,
  defaultCampaignSchedule,
  type CampaignScheduleValues,
} from "@/components/campaigns/campaign-schedule-fields";
import { getTimezoneLabel } from "@/lib/campaigns/timezones";
import { scoreColor } from "@/lib/campaigns/list-stats";
import {
  buildDraftCampaignPayload,
  createDraftStep,
} from "@/lib/campaigns/draft-campaign";
import {
  createInitialStepVariants,
  ensureStepVariantDefaults,
} from "@/lib/campaigns/step-variants";
import type { CampaignStep, GmailMailbox, Prospect } from "@prisma/client";
import { cn } from "@/lib/utils";

type TabId = CampaignDetailTabId;

interface CampaignCreateWizardProps {
  mailboxes: GmailMailbox[];
  initialProspects: Prospect[];
}

export function CampaignCreateWizard({
  mailboxes,
  initialProspects,
}: CampaignCreateWizardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("steps");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<CampaignStep[]>(() => [createDraftStep(0)]);
  const [schedule, setSchedule] = useState<CampaignScheduleValues>(defaultCampaignSchedule());
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (mailboxes.length > 0 && !mailboxId) {
      setMailboxId(mailboxes[0].id);
    }
  }, [mailboxes, mailboxId]);

  useEffect(() => {
    setProspects(initialProspects);
  }, [initialProspects]);

  const mailbox = mailboxes.find((m) => m.id === mailboxId) ?? mailboxes[0];

  const draftCampaign = useMemo(() => {
    if (!mailbox) return null;
    return buildDraftCampaignPayload({
      name,
      description,
      mailboxId: mailbox.id,
      mailbox,
      steps,
      prospects,
      selectedProspectIds,
      schedule,
    });
  }, [
    name,
    description,
    mailbox,
    mailboxId,
    steps,
    prospects,
    selectedProspectIds,
    schedule,
  ]);

  const loadProspects = useCallback(async () => {
    const res = await fetch("/api/prospects?limit=500");
    if (res.ok) {
      const data = await res.json();
      setProspects(data.prospects ?? []);
    }
  }, []);

  function addStep() {
    const draft = createNewStepDraft(steps.length);
    const { variants, activeVariantIndex } = createInitialStepVariants(
      draft.subject,
      draft.body,
    );
    const tempStep = {
      ...draft,
      id: `draft-step-${Date.now()}`,
      campaignId: "draft",
      variants,
      activeVariantIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CampaignStep;
    setSteps((prev) => [...prev, tempStep]);
    setEditingStepIndex(steps.length);
  }

  function saveSteps(updated: CampaignStep[]) {
    setSteps(updated.map((s) => ensureStepVariantDefaults(s)));
  }

  function addProspects(ids: string[]) {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  const settingsComplete =
    name.trim().length > 0 && !!mailboxId && schedule.sendWindowEndHour > schedule.sendWindowStartHour;

  const canCreate =
    settingsComplete &&
    steps.length > 0 &&
    steps.some((s) => {
      const synced = ensureStepVariantDefaults(s);
      return synced.isActive && synced.subject.trim() && synced.body.trim();
    });

  async function handleCreate() {
    if (!canCreate || !mailbox) return;

    setCreating(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        mailboxId: mailbox.id,
        prospectIds: selectedProspectIds,
        ...schedule,
        steps: steps.map((s) => {
          const synced = ensureStepVariantDefaults(s);
          return {
            stepNumber: synced.stepNumber,
            delayDays: synced.delayDays,
            subject: synced.subject,
            body: synced.body,
            isActive: synced.isActive,
            variants: synced.variants,
            activeVariantIndex: synced.activeVariantIndex,
          };
        }),
      }),
    });
    setCreating(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to create sequence");
      return;
    }

    const campaign = await res.json();
    toast.success("Sequence created");
    router.push(`/dashboard/campaigns/${campaign.id}`);
  }

  if (!mailbox || !draftCampaign) {
    return (
      <div className="p-8 text-on-surface-variant">
        <p className="mb-4">Connect a Gmail mailbox before creating a sequence.</p>
        <Link href="/dashboard/mailboxes" className="text-primary hover:underline">
          Go to Mailboxes
        </Link>
      </div>
    );
  }

  const previewProspects = prospects
    .filter((p) => selectedProspectIds.includes(p.id))
    .map((p) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      company: p.company,
      title: p.title,
    }));

  const tabs = [
    { id: "steps" as const, label: "Steps", count: steps.length },
    { id: "prospects" as const, label: "Prospects", count: selectedProspectIds.length },
    { id: "emails" as const, label: "Emails" },
    { id: "settings" as const, label: "Settings", completed: settingsComplete },
  ];

  return (
    <div className="min-h-full bg-surface">
      <div className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-outline-variant/50">
          <Link
            href="/dashboard/campaigns"
            className="text-[12px] text-on-surface-variant hover:text-primary"
          >
            Sequence
          </Link>
          <Icon name="chevron_right" size={14} className="text-on-surface-variant" />
          <h1 className="text-[14px] font-semibold text-on-surface truncate leading-none">
            {name.trim() || "New Sequence"}
          </h1>
        </div>

        <div className="flex items-center px-4 h-10 gap-3">
          <CampaignDetailStepper tabs={tabs} activeTab={tab} onTabChange={setTab} />

          {tab === "steps" && (
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold",
                  scoreColor(draftCampaign.stats.score),
                )}
                title="Sequence score"
              >
                {draftCampaign.stats.score}
              </span>
              <span className="text-[10px] text-on-surface-variant leading-none whitespace-nowrap hidden sm:inline">
                Sequence Score
              </span>
              <Button
                size="sm"
                onClick={addStep}
                className="gap-1 h-7 px-2.5 text-[12px] text-white"
              >
                <Icon name="add" size={15} className="text-white" />
                Add Step
              </Button>
            </div>
          )}

          {tab === "prospects" && steps.length > 0 && (
            <Button
              size="sm"
              onClick={() => setEnrollOpen(true)}
              className="gap-1 h-7 px-2.5 text-[12px] text-white shrink-0"
            >
              Add Prospects
              <Icon name="expand_more" size={16} className="text-white" />
            </Button>
          )}

          {tab === "settings" && (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="gap-1 h-7 px-2.5 text-[12px] text-white shrink-0"
            >
              {creating ? "Creating..." : "Create Sequence"}
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {tab === "steps" && (
          <CampaignSequenceTimeline
            campaign={draftCampaign}
            steps={steps}
            stepStats={draftCampaign.stepStats}
            mailboxEmail={mailbox.email}
            mailboxId={mailbox.id}
            previewProspects={previewProspects}
            editingIndex={editingStepIndex}
            onEditingIndexChange={setEditingStepIndex}
            onSave={saveSteps}
            onAddStep={addStep}
          />
        )}

        {tab === "prospects" && (
          <CampaignProspectsTab
            campaign={draftCampaign}
            onGoToSteps={() => setTab("steps")}
            onRefresh={loadProspects}
            enrollOpen={enrollOpen}
            onEnrollOpenChange={setEnrollOpen}
            onAddProspects={addProspects}
          />
        )}

        {tab === "emails" && (
          <CampaignEmailsTab campaign={draftCampaign} queueStatus={null} />
        )}

        {tab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-4">
              <h3 className="text-headline-sm">Sequence details</h3>
              <div className="space-y-2">
                <Label htmlFor="name">Sequence name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q2 outbound — SaaS founders"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about this sequence"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mailbox">Sending mailbox</Label>
                <select
                  id="mailbox"
                  value={mailboxId}
                  onChange={(e) => setMailboxId(e.target.value)}
                  className="flex h-10 w-full rounded border border-outline-variant bg-surface-container-low px-3 text-body-md"
                >
                  {mailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-4">
              <h3 className="text-headline-sm">Schedule &amp; targeting</h3>
              <p className="text-body-sm text-on-surface-variant">
                Emails send between your window in{" "}
                <strong className="text-on-surface">{getTimezoneLabel(schedule.timezone)}</strong>.
              </p>
              <CampaignScheduleFields values={schedule} onChange={setSchedule} />
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-3">
              <h3 className="text-headline-sm">Summary</h3>
              <ul className="text-body-sm text-on-surface-variant space-y-1">
                <li>
                  <strong className="text-on-surface">{steps.length}</strong> step
                  {steps.length === 1 ? "" : "s"}
                </li>
                <li>
                  <strong className="text-on-surface">{selectedProspectIds.length}</strong> prospect
                  {selectedProspectIds.length === 1 ? "" : "s"} selected
                </li>
                <li>
                  Sending from <strong className="text-on-surface">{mailbox.email}</strong>
                </li>
              </ul>
              <Button
                onClick={handleCreate}
                disabled={!canCreate || creating}
                className="mt-2 text-white"
              >
                {creating ? "Creating..." : "Create Sequence"}
              </Button>
              {!canCreate && (
                <p className="text-body-sm text-on-surface-variant">
                  {!name.trim()
                    ? "Enter a sequence name in Settings."
                    : steps.length === 0
                      ? "Add at least one step."
                      : "Each active step needs a subject and body."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
