"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  CampaignSequenceTimeline,
  createNewStepDraft,
} from "@/components/campaigns/campaign-sequence-timeline";
import {
  CampaignDetailStepper,
  type CampaignDetailTabId,
} from "@/components/campaigns/campaign-detail-stepper";
import { CampaignProspectsTab } from "@/components/campaigns/campaign-prospects-tab";
import { CampaignEmailsTab } from "@/components/campaigns/campaign-emails-tab";
import {
  CampaignScheduleFields,
  normalizeCampaignSchedule,
  type CampaignScheduleValues,
} from "@/components/campaigns/campaign-schedule-fields";
import {
  getTimezoneLabel,
} from "@/lib/campaigns/timezones";
import { scoreColor } from "@/lib/campaigns/list-stats";
import type { CampaignDetailPayload } from "@/lib/campaigns/detail-query";
import {
  createInitialStepVariants,
  ensureStepVariantDefaults,
} from "@/lib/campaigns/step-variants";
import type { CampaignStep } from "@prisma/client";
import { cn } from "@/lib/utils";

type TabId = CampaignDetailTabId;

type QueueStatus = {
  pendingCount: number;
  failedCount: number;
  sentCount: number;
  nextScheduled: string | null;
  items: {
    id: string;
    status: string;
    scheduledFor: string;
    stepNumber: number;
    prospect: string;
    email: string;
    lastError: string | null;
  }[];
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaign, setCampaign] = useState<CampaignDetailPayload | null>(null);
  const [tab, setTab] = useState<TabId>("steps");
  const [id, setId] = useState<string>("");
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [schedule, setSchedule] = useState<CampaignScheduleValues | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const loadCampaign = useCallback(async (campaignId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (!res.ok) return;
    const data: CampaignDetailPayload = await res.json();
    setCampaign(data);
    setSchedule(
      normalizeCampaignSchedule({
        timezone: data.timezone,
        sendWindowStartHour: data.sendWindowStartHour,
        sendWindowEndHour: data.sendWindowEndHour,
      }),
    );
  }, []);

  async function loadQueueStatus(campaignId: string) {
    const res = await fetch(`/api/campaigns/${campaignId}/send-now`);
    if (res.ok) {
      const data = await res.json();
      setQueueStatus(data.queue);
    }
  }

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      loadCampaign(p.id);
      loadQueueStatus(p.id);
    });
  }, [params, loadCampaign]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated: CampaignDetailPayload = await res.json();
      setCampaign(updated);
      toast.success(`Campaign ${status}`);
      if (status === "active") {
        loadQueueStatus(id);
        toast.message('Click "Send pending now" in Settings to send emails (required in local dev).');
      }
      if (status === "active" && updated.enrollments?.length === 0) {
        toast.message("No leads enrolled — add leads before emails will send.");
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update campaign");
    }
  }

  async function toggleActive() {
    if (!campaign) return;
    if (campaign.status === "draft") {
      await updateStatus("active");
      return;
    }
    if (campaign.status === "completed") {
      toast.message("This sequence is completed.");
      return;
    }

    const nextStatus = campaign.status === "active" ? "paused" : "active";
    setToggling(true);
    await updateStatus(nextStatus);
    setToggling(false);
  }

  async function saveSteps(steps: CampaignStep[]) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    if (res.ok) {
      const updated: CampaignDetailPayload = await res.json();
      setCampaign(updated);
      toast.success("Sequence saved");
      loadQueueStatus(id);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to save sequence");
    }
  }

  function addStep() {
    if (!campaign) return;
    const draft = createNewStepDraft(campaign.steps.length);
    const { variants, activeVariantIndex } = createInitialStepVariants(
      draft.subject,
      draft.body,
    );
    const tempStep = {
      ...draft,
      id: `new-${Date.now()}`,
      campaignId: campaign.id,
      variants,
      activeVariantIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CampaignStep;
    setCampaign({ ...campaign, steps: [...campaign.steps, tempStep] });
    setEditingStepIndex(campaign.steps.length);
  }

  async function saveSchedule() {
    if (!schedule) return;
    setSavingSchedule(true);
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    setSavingSchedule(false);

    if (res.ok) {
      const updated: CampaignDetailPayload = await res.json();
      setCampaign(updated);
      setSchedule(
        normalizeCampaignSchedule({
          timezone: updated.timezone,
          sendWindowStartHour: updated.sendWindowStartHour,
          sendWindowEndHour: updated.sendWindowEndHour,
        }),
      );
      toast.success("Schedule settings saved");
      loadQueueStatus(id);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to save schedule");
    }
  }

  async function sendNow() {
    setSending(true);
    const res = await fetch(`/api/campaigns/${id}/send-now`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (res.ok) {
      setQueueStatus(data.queue);
      if (data.sent > 0) {
        toast.success(data.message);
      } else {
        toast.message(data.message ?? "No emails sent");
      }
      if (data.errors?.length) {
        data.errors.forEach((e: string) => toast.error(e));
      }
      if (data.scopeHint) {
        toast.error(data.scopeHint, { duration: 10000 });
      }
      loadCampaign(id);
      loadQueueStatus(id);
    } else {
      toast.error(data.error ?? "Failed to send");
    }
  }

  if (!campaign) {
    return (
      <div className="p-8 text-on-surface-variant">Loading campaign...</div>
    );
  }

  const isActive = campaign.status === "active";
  const canToggle = campaign.status !== "completed";
  const previewProspects = campaign.enrollments.map((e) => ({
    firstName: e.prospect.firstName,
    lastName: e.prospect.lastName,
    email: e.prospect.email,
    company: e.prospect.company,
    title: e.prospect.title,
  }));

  const tabs = [
    { id: "steps" as const, label: "Steps", count: campaign.steps.length },
    { id: "prospects" as const, label: "Prospects", count: campaign.enrollments.length },
    { id: "emails" as const, label: "Emails" },
    {
      id: "settings" as const,
      label: "Settings",
      completed: campaign.status !== "draft",
    },
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
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-[14px] font-semibold text-on-surface truncate leading-none">
              {campaign.name}
            </h1>
            {canToggle && (
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                disabled={toggling}
                onClick={toggleActive}
                title={
                  campaign.status === "draft"
                    ? "Activate sequence"
                    : isActive
                      ? "Pause sequence"
                      : "Resume sequence"
                }
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40",
                  isActive ? "bg-primary" : "bg-outline-variant",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    isActive && "translate-x-4",
                  )}
                />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center px-4 h-10 gap-3">
          <CampaignDetailStepper tabs={tabs} activeTab={tab} onTabChange={setTab} />

          {tab === "steps" && (
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold",
                  scoreColor(campaign.stats.score),
                )}
                title="Sequence score"
              >
                {campaign.stats.score}
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

          {tab === "prospects" && campaign.steps.length > 0 && (
            <Button
              size="sm"
              onClick={() => setEnrollOpen(true)}
              className="gap-1 h-7 px-2.5 text-[12px] text-white shrink-0"
            >
              Add Existing Leads
              <Icon name="expand_more" size={16} className="text-white" />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {tab === "steps" && (
          <CampaignSequenceTimeline
            campaign={campaign}
            steps={campaign.steps}
            stepStats={campaign.stepStats}
            mailboxEmail={campaign.mailbox.email}
            mailboxId={campaign.mailboxId}
            previewProspects={previewProspects}
            editingIndex={editingStepIndex}
            onEditingIndexChange={setEditingStepIndex}
            onSave={saveSteps}
            onAddStep={addStep}
          />
        )}

        {tab === "prospects" && (
          <CampaignProspectsTab
            campaign={campaign}
            onGoToSteps={() => setTab("steps")}
            onRefresh={() => {
              loadCampaign(id);
              loadQueueStatus(id);
            }}
            enrollOpen={enrollOpen}
            onEnrollOpenChange={setEnrollOpen}
          />
        )}

        {tab === "emails" && (
          <CampaignEmailsTab campaign={campaign} queueStatus={queueStatus} />
        )}

        {tab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-4">
              <h3 className="text-headline-sm">Campaign status</h3>
              <p className="text-body-sm text-on-surface-variant">
                Sending from <strong className="text-on-surface">{campaign.mailbox.email}</strong> ·{" "}
                {getTimezoneLabel(campaign.timezone)}
              </p>
              <div className="flex flex-wrap gap-2">
                {campaign.status === "draft" && (
                  <Button onClick={() => updateStatus("active")}>Activate campaign</Button>
                )}
                {campaign.status === "active" && (
                  <>
                    <Button onClick={sendNow} disabled={sending}>
                      {sending ? "Sending..." : "Send pending now"}
                    </Button>
                    <Button variant="secondary" onClick={() => updateStatus("paused")}>
                      Pause
                    </Button>
                  </>
                )}
                {campaign.status === "paused" && (
                  <Button onClick={() => updateStatus("active")}>Resume</Button>
                )}
              </div>
              {campaign.status === "active" && (
                <p className="text-body-sm text-on-surface-variant border-t border-outline-variant pt-4">
                  <strong className="text-on-surface">Local dev:</strong> Emails do not send
                  automatically. Sends only go out between {campaign.sendWindowStartHour}:00–
                  {campaign.sendWindowEndHour}:00 {getTimezoneLabel(campaign.timezone)}.
                </p>
              )}
            </div>

            {schedule && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-headline-sm">Schedule &amp; targeting</h3>
                  <Button onClick={saveSchedule} disabled={savingSchedule}>
                    {savingSchedule ? "Saving..." : "Save schedule"}
                  </Button>
                </div>
                <CampaignScheduleFields values={schedule} onChange={setSchedule} />
              </div>
            )}

            {campaign.enrollments.length === 0 && (
              <p className="text-body-md text-error">
                No leads enrolled — enroll leads when creating or editing the campaign.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
