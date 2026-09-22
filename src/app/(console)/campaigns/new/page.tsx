import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CampaignWizard } from "./campaign-wizard";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New recovery campaign"
        description="Configure the campaign in six steps. The backend validates policy before any dialing."
        actions={
          <Button variant="outline" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="size-4" />
              Back to campaigns
            </Link>
          </Button>
        }
      />
      <CampaignWizard />
    </div>
  );
}
