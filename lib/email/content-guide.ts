import { htmlToPlainText } from "@/lib/email/html-body";

export type MetricStatus = "excellent" | "ideal" | "good" | "short" | "long" | "low" | "high";

export type ContentMetric = {
  id: string;
  label: string;
  value: string;
  suggestion: string;
  status: string;
  statusKind: MetricStatus;
  progress: number;
};

export type ContentGuideAnalysis = {
  metrics: ContentMetric[];
  mergeTagCount: number;
  hasSpintax: boolean;
};

const MERGE_TAG_PATTERN = /\{\{[a-z_]+\}\}/gi;
const LINK_PATTERN = /https?:\/\/[^\s]+/gi;
const SPINTAX_PATTERN = /\{[^{}|]+\|[^{}]+\}/;

const SPAM_WORDS = [
  "free",
  "buy now",
  "act now",
  "limited time",
  "guarantee",
  "winner",
  "cash",
  "urgent",
  "click here",
  "no obligation",
  "risk free",
  "100%",
  "congratulations",
  "dear friend",
  "apply now",
  "order now",
  "special promotion",
];

export const COLD_EMAIL_TIPS = [
  {
    title: "Use Spintax to maximize deliverability",
    body: "Spintax allows you to generate multiple variants in one email.",
    linkLabel: "Learn more",
  },
  {
    title: "Keep subjects between 30–60 characters",
    body: "Short, specific subject lines improve open rates without triggering spam filters.",
    linkLabel: "Learn more",
  },
  {
    title: "Add at least 2 merge tags",
    body: "Personalization with {{first_name}} and {{company}} helps emails feel one-to-one.",
    linkLabel: "Learn more",
  },
  {
    title: "Aim for 50–200 words in the body",
    body: "Concise emails get more replies than long pitches.",
    linkLabel: "Learn more",
  },
] as const;

function countMergeTags(text: string): number {
  return (text.match(MERGE_TAG_PATTERN) ?? []).length;
}

function countLinks(subject: string, bodyHtml: string, bodyPlain: string): number {
  const htmlLinks = (bodyHtml.match(/href\s*=\s*["']https?:\/\//gi) ?? []).length;
  const textLinks = (bodyPlain.match(LINK_PATTERN) ?? []).length + (subject.match(LINK_PATTERN) ?? []).length;
  return Math.max(htmlLinks, textLinks);
}

function countSpamWords(subject: string, bodyPlain: string): number {
  const combined = `${subject} ${bodyPlain}`.toLowerCase();
  return SPAM_WORDS.filter((word) => combined.includes(word)).length;
}

function subjectMetric(length: number): ContentMetric {
  let statusKind: MetricStatus = "ideal";
  let status = "Ideal";
  let progress = 100;

  if (length < 30) {
    statusKind = "short";
    status = "Short";
    progress = Math.min(100, Math.round((length / 30) * 70));
  } else if (length > 60) {
    statusKind = "long";
    status = "Long";
    progress = Math.max(40, 100 - Math.round(((length - 60) / 40) * 50));
  } else {
    progress = 70 + Math.round(((length - 30) / 30) * 30);
  }

  return {
    id: "subject-length",
    label: "Subject Length",
    value: `${length} character${length === 1 ? "" : "s"}`,
    suggestion: "30–60 characters suggested.",
    status,
    statusKind,
    progress,
  };
}

function wordCountMetric(words: number): ContentMetric {
  let statusKind: MetricStatus = "ideal";
  let status = "Ideal";
  let progress = 100;

  if (words < 50) {
    statusKind = "low";
    status = "Short";
    progress = Math.min(90, Math.round((words / 50) * 90));
  } else if (words > 200) {
    statusKind = "high";
    status = "Long";
    progress = Math.max(35, 100 - Math.round(((words - 200) / 150) * 50));
  }

  return {
    id: "word-count",
    label: "Word Count",
    value: `${words} word${words === 1 ? "" : "s"}`,
    suggestion: "50–200 words suggested.",
    status,
    statusKind,
    progress,
  };
}

function personalizationMetric(count: number): ContentMetric {
  const statusKind: MetricStatus = count >= 2 ? "good" : count === 1 ? "low" : "low";
  const status = count >= 2 ? "Good" : count === 1 ? "Low" : "Low";
  const progress = count >= 2 ? 100 : count === 1 ? 55 : 20;

  return {
    id: "personalization",
    label: "Personalization",
    value: `${count} merge tag${count === 1 ? "" : "s"}`,
    suggestion: "2 or more merge tags suggested.",
    status,
    statusKind,
    progress,
  };
}

function linksMetric(count: number): ContentMetric {
  const statusKind: MetricStatus = count === 0 ? "excellent" : count <= 1 ? "good" : "high";
  const status = count === 0 ? "Excellent" : count <= 1 ? "Good" : "High";
  const progress = count === 0 ? 100 : count <= 1 ? 70 : 35;

  return {
    id: "links",
    label: "Links",
    value: `${count} link${count === 1 ? "" : "s"}`,
    suggestion: "We suggest minimal usage.",
    status,
    statusKind,
    progress,
  };
}

function spamminessMetric(count: number): ContentMetric {
  const statusKind: MetricStatus = count === 0 ? "excellent" : count <= 2 ? "good" : "high";
  const status = count === 0 ? "Excellent" : count <= 2 ? "Good" : "High";
  const progress = count === 0 ? 100 : count <= 2 ? 65 : 30;

  return {
    id: "spamminess",
    label: "Spamminess",
    value: `${count} word${count === 1 ? "" : "s"}`,
    suggestion: "We suggest minimal usage.",
    status,
    statusKind,
    progress,
  };
}

export function analyzeEmailContent(subject: string, body: string): ContentGuideAnalysis {
  const plainBody = htmlToPlainText(body);
  const combined = `${subject} ${plainBody}`;
  const words = plainBody.trim() ? plainBody.trim().split(/\s+/).length : 0;
  const mergeTagCount = countMergeTags(combined);
  const hasSpintax = SPINTAX_PATTERN.test(combined);

  return {
    mergeTagCount,
    hasSpintax,
    metrics: [
      subjectMetric(subject.length),
      wordCountMetric(words),
      personalizationMetric(mergeTagCount),
      linksMetric(countLinks(subject, body, plainBody)),
      spamminessMetric(countSpamWords(subject, plainBody)),
    ],
  };
}

export function statusColor(kind: MetricStatus): string {
  switch (kind) {
    case "excellent":
    case "ideal":
    case "good":
      return "text-tertiary";
    case "short":
    case "long":
    case "low":
    case "high":
      return "text-warning";
    default:
      return "text-on-surface-variant";
  }
}

export function progressBarColor(kind: MetricStatus): string {
  switch (kind) {
    case "excellent":
    case "ideal":
    case "good":
      return "bg-tertiary";
    case "short":
    case "long":
    case "low":
    case "high":
      return "bg-warning";
    default:
      return "bg-outline-variant";
  }
}
