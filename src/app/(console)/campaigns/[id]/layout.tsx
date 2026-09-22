"use client";

/**
 * Campaign detail shell (spec §7) — header, lifecycle actions, live summary
 * metrics and tab navigation shared by all sub-routes. Child pages render the
 * tab content so deep links like /campaigns/{id}/leads work directly.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Pause,
  Pencil,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/page-states";
import { ConfirmActionDialog } from "@/components/ops";
import { TabNav, type TabItem } from "@/components/tab-nav";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { CampaignWithCounters } from "@/lib/types";

export default function CampaignDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const pathname = usePathname();
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [action, setAction] = useState<"pause" | "stop" | null>(null);
  const [acting, setActing] = useState(false);

  const campaign = useApi(
    campaignId ? () => api.getCampaign(campaignId) : null,
    [campaignId],
  );
  const metrics = useApi(
    campaignId ? () => api.getCampaignMetrics(campaignId) : null,
    [campaignId],
  );

  useRealtimeRefresh(
    useMemo(
      () => ({
        campaign: campaign.refresh,
        metrics: metrics.refresh,
      }),
      [campaign.refresh, metrics.refresh],
    ),
    // Overview-style screens want snappier reconciliation than lists.
    { refreshMs: 30_000 },
  );

  async function runLifecycle(kind: "pause" | "stop" | "resume" | "start") {
    if (!campaignId) return;
    setActing(true);
    try {
      if (kind === "pause") await api.pauseCampaign(campaignId);
      else if (kind === "stop") await api.stopCampaign(campaignId);
      else if (kind === "resume") await api.resumeCampaign(campaignId);
      else await api.startCampaign(campaignId);
      toast.success(kind === "start" ? "Campaign started." : `Campaign ${kind}d.`);
      campaign.refresh();
      metrics.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Could not ${kind} the campaign.`);
    } finally {
      setActing(false);
      setAction(null);
    }
  }

  const data: CampaignWithCounters | null = campaign.data;

  const tabs: TabItem[] = useMemo(
    () => [
      { href: `/campaigns/${campaignId}`, label: "Overview" },
      { href: `/campaigns/${campaignId}/leads`, label: "Leads" },
      { href: `/campaigns/${campaignId}/queue`, label: "Queue" },
      { href: `/campaigns/${campaignId}/follow-ups`, label: "Follow-ups" },
      { href: `/campaigns/${campaignId}/analytics`, label: "Analytics" },
      { href: `/campaigns/${campaignId}/exports`, label: "Exports" },
      { href: `/campaigns/${campaignId}/activity`, label: "Activity" },
    ],
    [campaignId],
  );

  if (campaign.loading && !data) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={campaign.error ?? "Campaign not found."} onRetry={campaign.refresh} />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/campaigns">Back to campaigns</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = data.status.toLowerCase();
  const m = metrics.data;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={data.name}
        description={`${data.creditor_name ?? "No creditor"} · Created ${formatDateTime(data.created_at)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/campaigns">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {allowed("campaign.pause") && status === "running" ? (
              <Button variant="outline" onClick={() => setAction("pause")}>
                <Pause className="size-4" />
                Pause
              </Button>
            ) : null}
            {allowed("campaign.start") &&
            (status === "paused" || status === "draft" || status === "ready") ? (
              <Button onClick={() => void runLifecycle(status === "paused" ? "resume" : "start")}>
                <Play className="size-4" />
                {status === "paused" ? "Resume" : "Start"}
              </Button>
            ) : null}
            {allowed("campaign.stop") && (status === "running" || status === "paused") ? (
              <Button variant="outline" onClick={() => setAction("stop")}>
                <Square className="size-4" />
                Stop
              </Button>
            ) : null}
            {allowed("campaign.update") ? (
              <Button variant="outline" asChild>
                <Link href={`/campaigns/${campaignId}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
            {allowed("export.create") ? (
              <Button variant="outline" asChild>
                <Link href={`/campaigns/${campaignId}/exports`}>
                  <Download className="size-4" />
                  Export
                </Link>
              </Button>
            ) : null}
            {allowed("campaign.create") && status === "running" ? (
              <Button variant="ghost" asChild>
                <Link href="/live-calls">Open live calls</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {/* Summary metric strip (spec §7) — all values from the metrics API. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryMetric label="Total leads" value={m?.total_leads ?? data.total_leads} href="leads" />
        <SummaryMetric label="Pending" value={m?.pending} href="leads" />
        <SummaryMetric label="Attempts" value={m?.attempted} href="analytics" />
        <SummaryMetric label="Connected" value={m?.connected} href="analytics" />
        <SummaryMetric label="Conversations" value={m?.conversations} href="call-analysis" />
        <SummaryMetric label="Promises" value={m?.promised} href="../recovery/ptp" />
        <SummaryMetric label="Paid" value={m?.paid} />
        <SummaryMetric label="Disputed" value={m?.disputed} href="../recovery/disputes" />
        <SummaryMetric label="Callbacks" value={m?.callbacks} href="../recovery/callbacks" />
        <SummaryMetric label="Escalations" value={m?.escalations} href="../recovery/escalations" />
      </div>

      <TabNav
        items={tabs}
        className={pathname.endsWith("/activity") ? "border-primary/40" : undefined}
      />

      <div className="pt-4">{children}</div>

      <ConfirmActionDialog
        open={action !== null}
        onOpenChange={(open) => (open ? null : setAction(null))}
        title={action === "stop" ? "Stop this campaign?" : "Pause this campaign?"}
        description={
          action === "stop"
            ? "Dialing stops immediately and the campaign cannot be resumed afterwards. Lead outcomes are preserved."
            : "Dialing pauses now; resume any time."
        }
        confirmLabel={action === "stop" ? "Stop campaign" : "Pause campaign"}
        loading={acting}
        onConfirm={() => {
          if (action) void runLifecycle(action);
        }}
      />
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  href,
}: {
  label: string;
  value: number | undefined | null;
  href?: string;
}) {
  return (
    <MetricTile label={label} value={value} href={href ? `${href}` : undefined} />
  );
}

function MetricTile({
  label,
  value,
  href,
}: {
  label: string;
  value: number | undefined | null;
  href?: string;
}) {
  return (
    <Link
      href={href ?? "#"}
      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value === undefined || value === null ? "—" : value.toLocaleString("en-IN")}
      </p>
    </Link>
  );
}
