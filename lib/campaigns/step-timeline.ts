import {
  campaignScheduleFromCampaign,
  computeScheduledFor,
  type CampaignScheduleConfig,
} from "@/lib/campaigns/schedule";
import { htmlToPlainText } from "@/lib/email/html-body";

type StepLike = { delayDays: number };

export function getStepDisplayDay(steps: StepLike[], index: number): number {
  if (steps.length === 0) return 1;
  let day = Math.max(1, steps[0].delayDays + 1);
  for (let i = 1; i <= index; i++) {
    day += steps[i].delayDays;
  }
  return day;
}

export function getStepScheduledDate(
  steps: StepLike[],
  index: number,
  config: CampaignScheduleConfig,
  baseDate: Date = new Date(),
): Date {
  let date = baseDate;
  for (let i = 0; i <= index; i++) {
    date = computeScheduledFor(date, steps[i].delayDays, config);
  }
  return date;
}

export function formatStepScheduleDate(date: Date, timeZone: string): string {
  return formatStepScheduleDateLong(date, timeZone);
}

export function formatStepScheduleDateLong(date: Date, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
  }).format(date);
  const day = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }).format(date),
  );
  const month = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "short",
  }).format(date);
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
  }).format(date);

  const ordinal = (n: number) => {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    const mod10 = n % 10;
    if (mod10 === 1) return `${n}st`;
    if (mod10 === 2) return `${n}nd`;
    if (mod10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  return `${weekday}, ${ordinal(day)} ${month} ${year}`;
}

export function getStepScheduleHint(
  steps: StepLike[],
  index: number,
  campaign: {
    timezone?: string | null;
    sendWindowStartHour?: number | null;
    sendWindowEndHour?: number | null;
  },
): string {
  const config = campaignScheduleFromCampaign(campaign);
  const date = getStepScheduledDate(steps, index, config);
  const formatted = formatStepScheduleDateLong(date, config.timezone);

  if (index === 0) {
    return `Sending as a new email on ${formatted}, if activated today`;
  }

  const step1Date = getStepScheduledDate(steps, 0, config);
  const step1Formatted = formatStepScheduleDateLong(step1Date, config.timezone);
  return `Sending as the same thread on ${formatted}, if step 1 is sent on ${step1Formatted}`;
}

export function truncateBodyPreview(body: string, maxLines = 2): string {
  const lines = htmlToPlainText(body).replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  return lines.slice(0, maxLines).join("\n");
}

export function truncateBodySingleLine(body: string, maxLength = 140): string {
  const flat = htmlToPlainText(body).replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength).trimEnd()}...`;
}
