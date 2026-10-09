import { DEFAULT_CAMPAIGN_TIMEZONE } from "@/lib/campaigns/timezones";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getZonedDateParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Convert a local datetime in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedDateParts(new Date(guess), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess += targetMs - actualMs;
  }

  return new Date(guess);
}

export function addDaysInTimezone(
  from: Date,
  days: number,
  timeZone: string,
  atHour: number,
): Date {
  const current = getZonedDateParts(from, timeZone);
  const anchor = zonedLocalToUtc(current.year, current.month, current.day, 12, 0, timeZone);
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  const next = getZonedDateParts(shifted, timeZone);
  return zonedLocalToUtc(next.year, next.month, next.day, atHour, 0, timeZone);
}

export function alignToSendWindow(
  date: Date,
  timeZone: string,
  startHour: number,
  endHour: number,
): Date {
  const parts = getZonedDateParts(date, timeZone);

  if (parts.hour >= startHour && parts.hour < endHour) {
    return date;
  }

  if (parts.hour < startHour) {
    return zonedLocalToUtc(parts.year, parts.month, parts.day, startHour, 0, timeZone);
  }

  return addDaysInTimezone(date, 1, timeZone, startHour);
}

export type CampaignScheduleConfig = {
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
};

export function campaignScheduleFromCampaign(campaign: {
  timezone?: string | null;
  sendWindowStartHour?: number | null;
  sendWindowEndHour?: number | null;
}): CampaignScheduleConfig {
  return {
    timezone: campaign.timezone || DEFAULT_CAMPAIGN_TIMEZONE,
    sendWindowStartHour: campaign.sendWindowStartHour ?? 9,
    sendWindowEndHour: campaign.sendWindowEndHour ?? 17,
  };
}

export function computeScheduledFor(
  baseDate: Date,
  delayDays: number,
  config: CampaignScheduleConfig,
): Date {
  const { timezone, sendWindowStartHour, sendWindowEndHour } = config;

  const scheduled =
    delayDays === 0
      ? baseDate
      : addDaysInTimezone(baseDate, delayDays, timezone, sendWindowStartHour);

  return alignToSendWindow(
    scheduled,
    timezone,
    sendWindowStartHour,
    sendWindowEndHour,
  );
}

export function getNextDailySendSlot(
  from: Date,
  config: CampaignScheduleConfig,
): Date {
  return addDaysInTimezone(from, 1, config.timezone, config.sendWindowStartHour);
}
