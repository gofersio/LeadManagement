"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import type { CampaignListItem } from "@/lib/campaigns/list-stats";

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [ownerInitial, setOwnerInitial] = useState("U");

  function loadCampaigns(silent = false) {
    if (!silent) setLoading(true);
    return fetch("/api/campaigns")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to load campaigns",
          );
        }
        return data;
      })
      .then((data) => {
        setCampaigns(Array.isArray(data) ? data : []);
        const first = data[0]?.owner;
        if (first?.fullName) {
          setOwnerInitial(first.fullName.charAt(0).toUpperCase());
        } else if (first?.email) {
          setOwnerInitial(first.email.charAt(0).toUpperCase());
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setLoading(false);
        toast.error(err.message ?? "Failed to load campaigns");
      });
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleDuplicate(campaign: CampaignListItem) {
    setDuplicatingId(campaign.id);
    const res = await fetch(`/api/campaigns/${campaign.id}/duplicate`, { method: "POST" });
    setDuplicatingId(null);

    if (res.ok) {
      const copy = await res.json();
      toast.success(`Duplicated as "${copy.name}"`);
      await loadCampaigns(true);
      router.push(`/dashboard/campaigns/${copy.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to duplicate campaign");
    }
  }

  async function handleDelete(campaign: CampaignListItem) {
    const confirmed = window.confirm(
      `Delete "${campaign.name}"? This removes all enrollments, sent email records, and queue items. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(campaign.id);
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    setDeletingId(null);

    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      toast.success("Campaign deleted");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delete campaign");
    }
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Sequences"
        subtitle="Manage email sequences and outreach performance"
      />

      <CampaignsTable
        campaigns={campaigns}
        loading={loading}
        ownerInitial={ownerInitial}
        onRefresh={() => loadCampaigns(true)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        deletingId={deletingId}
        duplicatingId={duplicatingId}
      />
    </div>
  );
}
