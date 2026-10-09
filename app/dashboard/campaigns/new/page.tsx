"use client";

import { useEffect, useState } from "react";
import { CampaignCreateWizard } from "@/components/campaigns/campaign-create-wizard";
import type { GmailMailbox, Prospect } from "@prisma/client";

export default function NewCampaignPage() {
  const [mailboxes, setMailboxes] = useState<GmailMailbox[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/mailboxes").then((r) => r.json()),
      fetch("/api/prospects?limit=500").then((r) => r.json()),
    ])
      .then(([mb, pr]) => {
        setMailboxes(mb.mailboxes ?? mb);
        setProspects(pr.prospects ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading...</div>;
  }

  return <CampaignCreateWizard mailboxes={mailboxes} initialProspects={prospects} />;
}
