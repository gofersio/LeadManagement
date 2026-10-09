/** Common IANA timezones for campaign targeting. */
export const CAMPAIGN_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (US & Canada)" },
  { value: "America/Chicago", label: "Central (US & Canada)" },
  { value: "America/Denver", label: "Mountain (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific (US & Canada)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris / Central Europe" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_CAMPAIGN_TIMEZONE = "America/New_York";

export function getDefaultCampaignTimezone(): string {
  return DEFAULT_CAMPAIGN_TIMEZONE;
}

export function getTimezoneLabel(value: string | undefined | null): string {
  if (!value) {
    return (
      CAMPAIGN_TIMEZONES.find((tz) => tz.value === DEFAULT_CAMPAIGN_TIMEZONE)?.label ??
      "Eastern (US & Canada)"
    );
  }
  return CAMPAIGN_TIMEZONES.find((tz) => tz.value === value)?.label ?? value.replace(/_/g, " ");
}

export function formatInCampaignTimezone(
  date: Date | string,
  timeZone: string | undefined | null,
): string {
  const tz = timeZone || DEFAULT_CAMPAIGN_TIMEZONE;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}
