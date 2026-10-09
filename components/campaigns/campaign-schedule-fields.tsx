import { Label } from "@/components/ui/label";
import {
  CAMPAIGN_TIMEZONES,
  getDefaultCampaignTimezone,
} from "@/lib/campaigns/timezones";

export type CampaignScheduleValues = {
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
};

interface CampaignScheduleFieldsProps {
  values: CampaignScheduleValues;
  onChange: (values: CampaignScheduleValues) => void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

export function CampaignScheduleFields({ values, onChange }: CampaignScheduleFieldsProps) {
  const schedule = normalizeCampaignSchedule(values);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="timezone">Campaign timezone</Label>
        <select
          id="timezone"
          value={schedule.timezone}
          onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
          className="flex h-10 w-full rounded border border-outline-variant bg-surface-container-low px-3 text-body-md"
        >
          {CAMPAIGN_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="text-body-sm text-on-surface-variant">
          Sends are scheduled in this timezone so you can target local business hours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sendWindowStartHour">Send window start</Label>
          <select
            id="sendWindowStartHour"
            value={schedule.sendWindowStartHour}
            onChange={(e) =>
              onChange({
                ...schedule,
                sendWindowStartHour: parseInt(e.target.value, 10),
              })
            }
            className="flex h-10 w-full rounded border border-outline-variant bg-surface-container-low px-3 text-body-md"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sendWindowEndHour">Send window end</Label>
          <select
            id="sendWindowEndHour"
            value={schedule.sendWindowEndHour}
            onChange={(e) =>
              onChange({
                ...schedule,
                sendWindowEndHour: parseInt(e.target.value, 10),
              })
            }
            className="flex h-10 w-full rounded border border-outline-variant bg-surface-container-low px-3 text-body-md"
          >
            {HOUR_OPTIONS.filter((h) => h > schedule.sendWindowStartHour).map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Emails only send between {formatHour(schedule.sendWindowStartHour)} and{" "}
        {formatHour(schedule.sendWindowEndHour)} in {schedule.timezone.replace(/_/g, " ")}.
        Follow-ups use the start of the send window on the scheduled day.
      </p>
    </div>
  );
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

export function defaultCampaignSchedule(): CampaignScheduleValues {
  return {
    timezone: getDefaultCampaignTimezone(),
    sendWindowStartHour: 9,
    sendWindowEndHour: 17,
  };
}

export function normalizeCampaignSchedule(
  input?: Partial<CampaignScheduleValues> | null,
): CampaignScheduleValues {
  const defaults = defaultCampaignSchedule();
  return {
    timezone: input?.timezone || defaults.timezone,
    sendWindowStartHour: input?.sendWindowStartHour ?? defaults.sendWindowStartHour,
    sendWindowEndHour: input?.sendWindowEndHour ?? defaults.sendWindowEndHour,
  };
}
