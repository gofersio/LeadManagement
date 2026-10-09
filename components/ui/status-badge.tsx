import type { CampaignStatus, EnrollmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const campaignLabels: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "warning" }> = {
  active: { label: "SENDING", variant: "default" },
  paused: { label: "PAUSED", variant: "secondary" },
  draft: { label: "DRAFT", variant: "secondary" },
  completed: { label: "COMPLETED", variant: "secondary" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, variant } = campaignLabels[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const map: Record<EnrollmentStatus, string> = {
    active: "ACTIVE",
    replied: "REPLIED",
    unsubscribed: "UNSUBSCRIBED",
    bounced: "BOUNCED",
    stopped: "STOPPED",
    completed: "COMPLETED",
    paused: "PAUSED",
  };
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {map[status]}
    </Badge>
  );
}
