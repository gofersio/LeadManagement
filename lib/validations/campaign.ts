import { z } from "zod";

export const campaignStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  subject: z.string().min(1),
  body: z.string().min(1),
  isActive: z.boolean().default(true),
  variants: z
    .array(z.object({ subject: z.string().min(1), body: z.string().min(1) }))
    .optional(),
  activeVariantIndex: z.number().int().min(0).optional(),
});

export const campaignCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  mailboxId: z.string().min(1),
  timezone: z.string().min(1).default("America/New_York"),
  sendWindowStartHour: z.number().int().min(0).max(23).default(9),
  sendWindowEndHour: z.number().int().min(1).max(24).default(17),
  steps: z.array(campaignStepSchema).min(1),
  prospectIds: z.array(z.string()).optional(),
}).refine((d) => d.sendWindowEndHour > d.sendWindowStartHour, {
  message: "Send window end must be after start",
  path: ["sendWindowEndHour"],
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  mailboxId: z.string().optional(),
  timezone: z.string().min(1).optional(),
  sendWindowStartHour: z.number().int().min(0).max(23).optional(),
  sendWindowEndHour: z.number().int().min(1).max(24).optional(),
  steps: z.array(campaignStepSchema).optional(),
  prospectIds: z.array(z.string()).optional(),
}).refine(
  (d) =>
    d.sendWindowStartHour === undefined ||
    d.sendWindowEndHour === undefined ||
    d.sendWindowEndHour > d.sendWindowStartHour,
  {
    message: "Send window end must be after start",
    path: ["sendWindowEndHour"],
  },
);

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
