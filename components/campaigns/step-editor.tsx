"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StepEditorDialog } from "@/components/campaigns/step-editor-dialog";
import {
  type CampaignStepDraft,
  type PreviewProspect,
  stepLetter,
} from "@/lib/campaigns/step-types";
import { cn } from "@/lib/utils";

export type { CampaignStepDraft };

interface StepEditorProps {
  steps: CampaignStepDraft[];
  onChange: (steps: CampaignStepDraft[]) => void;
  mailboxEmail?: string;
  mailboxId?: string;
  previewProspects?: PreviewProspect[];
}

export function StepEditor({
  steps,
  onChange,
  mailboxEmail,
  mailboxId,
  previewProspects,
}: StepEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function updateStep(index: number, patch: Partial<CampaignStepDraft>) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function saveStep(index: number, step: CampaignStepDraft) {
    updateStep(index, step);
  }

  function addStep() {
    const next: CampaignStepDraft = {
      stepNumber: steps.length + 1,
      delayDays: steps.length === 0 ? 0 : 3,
      subject: "Following up, {{first_name}}",
      body: "Hi {{first_name}},\n\nJust following up on my previous email.\n\nBest,",
      isActive: true,
    };
    onChange([...steps, next]);
    setEditingIndex(steps.length);
  }

  function removeStep(index: number) {
    const next = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onChange(next);
    setEditingIndex(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-headline-sm">Email Sequence</h3>
        <p className="text-label-sm text-on-surface-variant">
          Click a step to edit and preview
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {steps.map((step, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setEditingIndex(index)}
            className={cn(
              "flex items-center gap-3 min-w-[200px] p-4 rounded border text-left transition-colors",
              "border-outline-variant bg-surface-container-low hover:border-primary hover:bg-primary-container/30",
              !step.isActive && "opacity-60",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-label-md">
              {stepLetter(index)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label-md text-on-surface">Step {step.stepNumber}</p>
              <p className="text-body-sm text-on-surface-variant truncate">
                {step.subject || "No subject"}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1">
                Day {index === 0 ? step.delayDays + 1 : `+${step.delayDays}`} ·{" "}
                {step.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <Icon name="edit" size={18} className="text-on-surface-variant shrink-0" />
          </button>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="flex items-center justify-center gap-2 min-w-[140px] p-4 rounded border border-dashed border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          <Icon name="add" size={20} />
          <span className="text-label-md">Add Step</span>
        </button>
      </div>

      {editingIndex !== null && steps[editingIndex] && (
        <StepEditorDialog
          open={editingIndex !== null}
          onOpenChange={(open) => !open && setEditingIndex(null)}
          step={steps[editingIndex]}
          stepIndex={editingIndex}
          totalSteps={steps.length}
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
