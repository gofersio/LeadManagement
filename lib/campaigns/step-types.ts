export type CampaignStepDraft = {
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  isActive: boolean;
};

export type PreviewProspect = {
  firstName: string;
  lastName?: string | null;
  email: string;
  company?: string | null;
  title?: string | null;
};

export const EXAMPLE_PROSPECT: PreviewProspect = {
  firstName: "Example",
  lastName: "Contact",
  email: "example@company.com",
  company: "Example Co",
  title: "VP Sales",
};

export function stepLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function createNewStepDraft(stepCount: number): CampaignStepDraft {
  return {
    stepNumber: stepCount + 1,
    delayDays: stepCount === 0 ? 0 : 3,
    subject:
      stepCount === 0
        ? "Quick question, {{first_name}}"
        : "Following up, {{first_name}}",
    body:
      stepCount === 0
        ? "Hi {{first_name}},\n\nI wanted to reach out about {{company}}.\n\nBest,"
        : "Hi {{first_name}},\n\nJust following up on my previous email.\n\nBest,",
    isActive: true,
  };
}
