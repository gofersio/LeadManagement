import { z } from "zod";

export const prospectSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
  title: z.string().optional(),
  linkedInUrl: z.string().url().optional().or(z.literal("")),
  source: z.string().min(1, "Source is required"),
  status: z
    .enum(["new", "contacted", "replied", "unsubscribed", "bounced", "stopped"])
    .optional(),
});

export const prospectUpdateSchema = prospectSchema.partial();

export type ProspectInput = z.infer<typeof prospectSchema>;
