"use client";

import { Icon } from "@/components/ui/icon";
import { StepEditorDialog } from "@/components/campaigns/step-editor-dialog";
import {
  getStepDisplayDay,
  getStepScheduleHint,
  truncateBodyPreview,
  truncateBodySingleLine,
} from "@/lib/campaigns/step-timeline";
import {
  addStepVariant,
  ensureStepVariantDefaults,
  getActiveStepVariant,
  normalizeStepVariants,
  setActiveStepVariant,
  syncStepWithActiveVariant,
  updateStepVariant,
} from "@/lib/campaigns/step-variants";
import type { StepStats } from "@/lib/campaigns/detail-query";
import {
  type CampaignStepDraft,
  type PreviewProspect,
  createNewStepDraft,
  stepLetter,
} from "@/lib/campaigns/step-types";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStep } from "@prisma/client";

interface CampaignSequenceTimelineProps {
  campaign: Pick<
    Campaign,
    "timezone" | "sendWindowStartHour" | "sendWindowEndHour"
  >;
  steps: CampaignStep[];
  stepStats: Record<string, StepStats>;
  mailboxEmail: string;
  mailboxId: string;
  previewProspects?: PreviewProspect[];
  editingIndex: number | null;
  onEditingIndexChange: (index: number | null) => void;
  onSave: (steps: CampaignStep[]) => void;
  onAddStep?: () => void;
}

function toDraft(step: CampaignStep): CampaignStepDraft {
  const active = getActiveStepVariant(step);
  return {
    stepNumber: step.stepNumber,
    delayDays: step.delayDays,
    subject: active.subject,
    body: active.body,
    isActive: step.isActive,
  };
}

function shortStepId(id: string): string {
  return id.length > 10 ? id.slice(-10) : id;
}

function StepLetterBadge({ variantIndex }: { variantIndex: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
      {stepLetter(variantIndex)}
    </span>
  );
}

export function CampaignSequenceTimeline({
  campaign,
  steps,
  stepStats,
  mailboxEmail,
  mailboxId,
  previewProspects,
  editingIndex,
  onEditingIndexChange,
  onSave,
  onAddStep,
}: CampaignSequenceTimelineProps) {
  function persistSteps(updated: CampaignStep[]) {
    onSave(updated.map((s) => ensureStepVariantDefaults(s)));
  }

  function saveStep(index: number, draft: CampaignStepDraft) {
    const step = steps[index];
    const { activeVariantIndex } = normalizeStepVariants(step);
    const updated = steps.map((s, i) => {
      if (i !== index) return s;
      return syncStepWithActiveVariant(
        updateStepVariant(s, activeVariantIndex, {
          subject: draft.subject,
          body: draft.body,
        }),
      ) as CampaignStep;
    });
    updated[index] = {
      ...updated[index],
      delayDays: draft.delayDays,
      isActive: draft.isActive,
    };
    persistSteps(updated);
    onEditingIndexChange(null);
  }

  function removeStep(index: number) {
    const updated = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    persistSteps(updated);
    onEditingIndexChange(null);
  }

  function createVariant(index: number) {
    const updated = steps.map((s, i) =>
      i === index ? (addStepVariant(s) as CampaignStep) : s,
    );
    persistSteps(updated);
    onEditingIndexChange(index);
  }

  function selectVariant(stepIndex: number, variantIndex: number) {
    const updated = steps.map((s, i) =>
      i === stepIndex ? (setActiveStepVariant(s, variantIndex) as CampaignStep) : s,
    );
    persistSteps(updated);
  }

  function closeEditor(open: boolean) {
    if (!open) onEditingIndexChange(null);
  }

  if (steps.length === 0) {
    return (
      <div className="rounded border border-dashed border-outline-variant p-8 text-center">
        <p className="text-body-sm text-on-surface-variant mb-3">No steps yet.</p>
        {onAddStep && (
          <button
            type="button"
            onClick={onAddStep}
            className="inline-flex items-center gap-1.5 text-primary text-[13px] font-medium hover:underline"
          >
            <Icon name="add" size={16} />
            Add your first step
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="absolute left-[38px] top-6 bottom-6 w-px bg-outline-variant/50" />

      <div className="space-y-4">
        {steps.map((step, index) => {
          const day = getStepDisplayDay(steps, index);
          const stats = stepStats[step.id] ?? { sent: 0, opened: null, replied: null };
          const scheduleHint = getStepScheduleHint(steps, index, campaign);
          const isFirst = index === 0;
          const { variants, activeVariantIndex } = normalizeStepVariants(step);
          const activeVariant = variants[activeVariantIndex];

          return (
            <div key={step.id} className="flex gap-3">
              <div className="w-12 shrink-0 pt-0.5">
                <div className="rounded bg-surface-container-high px-1.5 py-1 text-center text-[10px] font-medium text-on-surface-variant">
                  Day {day}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 pr-1">
                  <Icon
                    name="subdirectory_arrow_right"
                    size={16}
                    className="shrink-0 text-on-surface-variant"
                  />
                  <p className="text-[12px] text-on-surface-variant flex-1 min-w-0 leading-snug">
                    <span className="font-semibold text-on-surface">Step {step.stepNumber}</span>
                    <span className="mx-1.5 text-outline-variant">·</span>
                    {scheduleHint}
                    <Icon name="info" size={12} className="inline ml-1 opacity-40 align-middle" />
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isFirst && (
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {shortStepId(step.id)}
                      </span>
                    )}
                    {isFirst ? (
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[9px] font-bold text-on-surface-variant"
                        title={mailboxEmail}
                      >
                        {mailboxEmail.slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="text-on-surface-variant hover:text-error p-0.5"
                          aria-label="Delete step"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {variants.length > 1 && (
                  <div className="flex items-center gap-1 pl-1">
                    {variants.map((_, variantIndex) => (
                      <button
                        key={variantIndex}
                        type="button"
                        onClick={() => selectVariant(index, variantIndex)}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-colors",
                          variantIndex === activeVariantIndex
                            ? "bg-primary/10 text-primary"
                            : "text-on-surface-variant hover:bg-surface-container-high",
                        )}
                      >
                        {stepLetter(variantIndex)}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onEditingIndexChange(index)}
                  className={cn(
                    "w-full text-left rounded-md border border-outline-variant/80 bg-surface-container-lowest",
                    "hover:border-primary/30 transition-colors overflow-hidden",
                    !step.isActive && "opacity-60",
                  )}
                >
                  <div className="flex items-stretch">
                    <div className="flex flex-1 items-start gap-2.5 min-w-0 p-3">
                      <StepLetterBadge variantIndex={activeVariantIndex} />
                      <div className="min-w-0 flex-1">
                        {isFirst ? (
                          <>
                            <p className="text-[13px] font-semibold text-on-surface mb-1 line-clamp-1">
                              {activeVariant.subject || "No subject"}
                            </p>
                            <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2 whitespace-pre-wrap">
                              {truncateBodyPreview(activeVariant.body, 2)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[12px] font-medium text-on-surface mb-0.5">
                              &lt;sending as a same thread&gt;
                            </p>
                            <p className="text-[12px] text-on-surface-variant truncate">
                              {truncateBodySingleLine(activeVariant.body)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 border-l border-outline-variant/60 px-4 py-2">
                      <MetricCell label="Sent" value={stats.sent} />
                      <MetricCell label="Opened" value={stats.opened} />
                      <MetricCell label="Replied" value={stats.replied} />
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-3 pl-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary"
                  >
                    <Icon name="auto_awesome" size={13} className="text-primary/70" />
                    Generate AI variant
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditingIndexChange(index)}
                    className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary"
                  >
                    <Icon name="edit" size={13} />
                    Edit step
                  </button>
                  <button
                    type="button"
                    onClick={() => createVariant(index)}
                    className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary"
                  >
                    <Icon name="edit" size={13} />
                    Create variant
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onAddStep && (
        <button
          type="button"
          onClick={onAddStep}
          className="mt-4 ml-[60px] inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
        >
          <Icon name="add" size={16} />
          Add Step
        </button>
      )}

      {editingIndex !== null && steps[editingIndex] && (
        <StepEditorDialog
          open={editingIndex !== null}
          onOpenChange={closeEditor}
          step={toDraft(steps[editingIndex])}
          stepIndex={normalizeStepVariants(steps[editingIndex]).activeVariantIndex}
          totalSteps={normalizeStepVariants(steps[editingIndex]).variants.length}
          mailboxEmail={mailboxEmail}
          mailboxId={mailboxId}
          previewProspects={previewProspects}
          onSave={(updated) => saveStep(editingIndex, updated)}
          onRemove={
            steps.length > 1
              ? () => {
                  removeStep(editingIndex);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center min-w-[44px]">
      <p className="text-[13px] font-bold text-on-surface leading-none">
        {value === null ? "—" : value}
      </p>
      <p className="text-[10px] text-on-surface-variant mt-1">{label}</p>
    </div>
  );
}

export { createNewStepDraft } from "@/lib/campaigns/step-types";
