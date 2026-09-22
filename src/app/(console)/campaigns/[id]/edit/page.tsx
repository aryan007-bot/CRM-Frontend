"use client";

/**
 * Campaign edit route — reuses the Phase 1 campaign settings dialog inline.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { CampaignDialog } from "../../campaign-dialog";

export default function EditCampaignPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const campaign = useApi(campaignId ? () => api.getCampaign(campaignId) : null, [campaignId]);
  const [saved, setSaved] = useState(false);

  if (campaign.loading && !campaign.data) {
    return <div className="mx-auto max-w-4xl"><ErrorState message="Loading campaign…" compact /></div>;
  }

  if (!campaign.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={campaign.error ?? "Campaign not found."} onRetry={campaign.refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Edit · ${campaign.data.name}`}
        description="Core campaign settings. Retry policy and strategy are enforced by the backend."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaignId}`}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />
      <CampaignDialog
        open
        onOpenChange={(open) => {
          if (!open) setSaved(true);
        }}
        campaign={campaign.data}
        onSaved={() => {
          campaign.refresh();
          setSaved(true);
        }}
      />
      {saved ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Changes saved.</p>
      ) : null}
    </div>
  );
}
