"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import {
  EmailRichTextEditor,
  MergeTagPills,
  type EmailRichTextEditorHandle,
} from "@/components/campaigns/email-rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renderSubject, renderTemplate } from "@/lib/email/render-template";
import { htmlToPlainText, isHtmlBody } from "@/lib/email/html-body";
import { ContentGuidePanel } from "@/components/campaigns/content-guide-panel";
import { MERGE_TAGS } from "@/lib/campaigns/editor-constants";
import {
  EXAMPLE_PROSPECT,
  type CampaignStepDraft,
  type PreviewProspect,
  stepLetter,
} from "@/lib/campaigns/step-types";
import { cn } from "@/lib/utils";

interface StepEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: CampaignStepDraft;
  stepIndex: number;
  totalSteps: number;
  mailboxEmail?: string;
  mailboxId?: string;
  previewProspects?: PreviewProspect[];
  onSave: (step: CampaignStepDraft) => void;
  onRemove?: () => void;
}

export function StepEditorDialog({
  open,
  onOpenChange,
  step,
  stepIndex,
  totalSteps,
  mailboxEmail,
  mailboxId,
  previewProspects = [],
  onSave,
  onRemove,
}: StepEditorDialogProps) {
  const [draft, setDraft] = useState(step);
  const [previewTab, setPreviewTab] = useState<"guide" | "preview">("guide");
  const [previewSource, setPreviewSource] = useState<string>("example");
  const [customProspect, setCustomProspect] = useState<PreviewProspect>(EXAMPLE_PROSPECT);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState(mailboxEmail ?? "");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<EmailRichTextEditorHandle>(null);

  useEffect(() => {
    if (open) {
      setDraft(step);
      setPreviewTab("guide");
      setPreviewSource(previewProspects.length > 0 ? "prospect-0" : "example");
      setCustomProspect(EXAMPLE_PROSPECT);
      setTestEmail(mailboxEmail ?? "");
    }
  }, [open, step, mailboxEmail, previewProspects.length]);

  const enrolledProspects =
    previewProspects.length > 0 ? previewProspects : [];

  const prospect = resolvePreviewProspect(
    previewSource,
    enrolledProspects,
    customProspect,
  );

  const previewSubject = renderSubject(draft.subject, prospect);
  const previewBody = renderTemplate(draft.body, prospect);
  const previewBodyPlain = htmlToPlainText(previewBody);

  function insertBodyTag(tag: string) {
    bodyEditorRef.current?.insertText(tag);
  }

  function insertTag(tag: string, field: "subject" | "body") {
    if (field === "body") {
      insertBodyTag(tag);
      return;
    }

    const el = subjectRef.current;
    if (!el) {
      setDraft((prev) => ({ ...prev, subject: prev.subject + tag }));
      return;
    }

    const start = el.selectionStart ?? draft.subject.length;
    const end = el.selectionEnd ?? draft.subject.length;
    const value = draft.subject;
    const next = value.slice(0, start) + tag + value.slice(end);

    setDraft((prev) => ({ ...prev, subject: next }));

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleSave() {
    const bodyText = htmlToPlainText(draft.body).trim();
    if (!draft.subject.trim() || !bodyText) {
      toast.error("Subject and body are required");
      return;
    }
    onSave(draft);
    onOpenChange(false);
    toast.success(`Step ${draft.stepNumber} saved`);
  }

  async function handleSendTest() {
    if (!mailboxId) {
      toast.error("Connect a sending mailbox first");
      return;
    }
    if (!testEmail.trim()) {
      toast.error("Enter a test email address");
      return;
    }

    setSendingTest(true);
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        to: testEmail,
        subject: draft.subject,
        body: draft.body,
        prospect: {
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          email: prospect.email,
          company: prospect.company,
          title: prospect.title,
        },
      }),
    });
    setSendingTest(false);

    if (res.ok) {
      toast.success(`Test email sent to ${testEmail}`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to send test email");
    }
  }

  const delayLabel =
    stepIndex === 0 ? "Days after sequence starts" : "Days after previous step";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-outline-variant flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-container text-on-primary-container text-label-md font-bold">
              {stepLetter(stepIndex)}
            </span>
            <div className="flex items-center gap-2">
              <Icon name="mail" size={20} className="text-primary" />
              <DialogTitle className="text-headline-sm mb-0">
                Step {draft.stepNumber} · Email
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex flex-col min-w-0 border-r border-outline-variant">
            <div className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
              <div className="space-y-2">
                <Label htmlFor="step-subject">Subject</Label>
                <div className="flex gap-2">
                  <Input
                    id="step-subject"
                    ref={subjectRef}
                    value={draft.subject}
                    onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))}
                    className="flex-1"
                    placeholder="Email subject line"
                  />
                  <MergeTagButtons onInsert={(tag) => insertTag(tag, "subject")} compact />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="step-body"
                    className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-0"
                  >
                    Email body
                  </Label>
                  <MergeTagPills onInsert={insertBodyTag} />
                </div>
                <EmailRichTextEditor
                  ref={bodyEditorRef}
                  value={draft.body}
                  onChange={(body) => setDraft((p) => ({ ...p, body }))}
                  placeholder="Write your email..."
                  className="flex-1 min-h-[280px]"
                />
              </div>

              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Step is active
              </label>
            </div>
          </div>

          <div className="w-full max-w-md flex flex-col bg-surface-container-low">
            <div className="flex border-b border-outline-variant bg-surface-container-lowest">
              <PreviewTab
                active={previewTab === "guide"}
                onClick={() => setPreviewTab("guide")}
                icon="description"
              >
                Content Guide
              </PreviewTab>
              <PreviewTab
                active={previewTab === "preview"}
                onClick={() => setPreviewTab("preview")}
                icon="mail"
              >
                Email Preview
              </PreviewTab>
            </div>

            {previewTab === "guide" ? (
              <ContentGuidePanel
                subject={draft.subject}
                body={draft.body}
                onInsertSpintax={() => bodyEditorRef.current?.openSpintax()}
                onOpenMergeTags={() => bodyEditorRef.current?.openMergeTags()}
              />
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="p-4 space-y-3 border-b border-outline-variant text-body-sm">
                  <div>
                    <span className="text-on-surface-variant">From</span>
                    <p className="font-medium truncate">{mailboxEmail ?? "No mailbox selected"}</p>
                  </div>
                  <div>
                    <span className="text-on-surface-variant">Preview as</span>
                    <select
                      value={previewSource}
                      onChange={(e) => setPreviewSource(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded border border-outline-variant bg-surface-container-low px-2 text-body-sm"
                    >
                      <option value="example">Example Contact</option>
                      {enrolledProspects.map((p, index) => (
                        <option key={`${p.email}-${index}`} value={`prospect-${index}`}>
                          {p.firstName} {p.lastName ?? ""} ({p.email})
                        </option>
                      ))}
                      <option value="custom">Custom name...</option>
                    </select>
                    {previewSource === "custom" && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <PreviewField
                          label="First name"
                          value={customProspect.firstName}
                          onChange={(firstName) =>
                            setCustomProspect((p) => ({ ...p, firstName }))
                          }
                        />
                        <PreviewField
                          label="Last name"
                          value={customProspect.lastName ?? ""}
                          onChange={(lastName) =>
                            setCustomProspect((p) => ({ ...p, lastName }))
                          }
                        />
                        <PreviewField
                          label="Company"
                          value={customProspect.company ?? ""}
                          onChange={(company) =>
                            setCustomProspect((p) => ({ ...p, company }))
                          }
                        />
                        <PreviewField
                          label="Title"
                          value={customProspect.title ?? ""}
                          onChange={(title) =>
                            setCustomProspect((p) => ({ ...p, title }))
                          }
                        />
                        <div className="col-span-2">
                          <PreviewField
                            label="Email (preview only)"
                            value={customProspect.email}
                            onChange={(email) =>
                              setCustomProspect((p) => ({ ...p, email }))
                            }
                          />
                        </div>
                      </div>
                    )}
                    <p className="font-medium truncate mt-2">
                      To: {prospect.firstName} {prospect.lastName ?? ""} &lt;{prospect.email}&gt;
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      Use <code className="text-[10px]">{"{{first_name}}"}</code> in your email
                      body — names come from each lead&apos;s profile when sent.
                    </p>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto bg-surface-container-lowest m-4 rounded border border-outline-variant">
                  <p className="text-label-sm text-on-surface-variant mb-1">Subject</p>
                  <p className="font-bold text-body-md mb-4">{previewSubject || "(No subject)"}</p>
                  <p className="text-label-sm text-on-surface-variant mb-1">Body</p>
                  {isHtmlBody(previewBody) ? (
                    <div
                      className="text-body-sm text-on-surface prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewBody }}
                    />
                  ) : (
                    <div className="text-body-sm whitespace-pre-wrap text-on-surface">
                      {previewBodyPlain || "(No body)"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-body-sm">
              <span>Start this step after</span>
              <Input
                type="number"
                min={0}
                className="w-16 h-8 text-center"
                value={draft.delayDays}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    delayDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
              <span>{delayLabel.toLowerCase()}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {stepIndex === 0
                ? "0 days = ready when the campaign is activated (within send window)."
                : `Step ${draft.stepNumber} of ${totalSteps} in your sequence.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRemove && (
              <Button type="button" variant="ghost" className="text-error mr-auto" onClick={onRemove}>
                Remove step
              </Button>
            )}
            {mailboxId && (
              <div className="flex items-center gap-2 mr-2">
                <Input
                  type="email"
                  placeholder="Test email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="h-9 w-44 text-body-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                >
                  {sendingTest ? "Sending..." : "Send Test Email"}
                </Button>
              </div>
            )}
            <Button type="button" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] border-b-2 transition-colors",
        active
          ? "border-primary text-primary font-medium"
          : "border-transparent text-on-surface-variant hover:text-on-surface",
      )}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}

function resolvePreviewProspect(
  source: string,
  enrolled: PreviewProspect[],
  custom: PreviewProspect,
): PreviewProspect {
  if (source === "custom") return custom;
  if (source === "example") return EXAMPLE_PROSPECT;
  if (source.startsWith("prospect-")) {
    const index = parseInt(source.replace("prospect-", ""), 10);
    return enrolled[index] ?? EXAMPLE_PROSPECT;
  }
  return EXAMPLE_PROSPECT;
}

function PreviewField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-on-surface-variant">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 mt-0.5 text-body-sm"
      />
    </label>
  );
}

function MergeTagButtons({
  onInsert,
  compact,
}: {
  onInsert: (tag: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-1", compact && "shrink-0")}>
      {MERGE_TAGS.map(({ tag }) => (
        <button
          key={tag}
          type="button"
          title={`Insert ${tag}`}
          onClick={() => onInsert(tag)}
          className="h-9 px-2 rounded border border-outline-variant bg-surface-container-low text-label-sm hover:bg-surface-container-high"
        >
          {compact ? tag.replace(/[{}]/g, "") : tag}
        </button>
      ))}
    </div>
  );
}
