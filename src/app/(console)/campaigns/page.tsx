"use client";

/**
 * Campaigns (spec §5) — operational list with URL-synchronised filters,
 * outcome counters and lifecycle row actions.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Copy,
  Download,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar, SearchInput } from "@/components/ops";
import { Phase3CampaignStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatCount, formatRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { CampaignWithCounters } from "@/lib/types";

const STATUS_OPTIONS = [
  "DRAFT",
  "READY",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "STOPPED",
  "FAILED",
];

function Num({ value }: { value: number | null | undefined }) {
  return (
    <span className="text-right tabular-nums">
      {value === null || value === undefined ? "—" : formatCount(value)}
    </span>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roles = user?.roles;

  const allowed = (capability: Capability) => can(capability, roles);

  const status = searchParams.get("status") ?? "all";
  const creditorId = searchParams.get("creditor") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = 25;

  const [actionTarget, setActionTarget] = useState<{
    campaign: CampaignWithCounters;
    action: "pause" | "stop";
  } | null>(null);
  const [acting, setActing] = useState(false);

  /** Merges values into the current URL params, resetting to page 1. */
  function setPageParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    router.replace(`${location.pathname}?${next.toString()}`, { scroll: false });
  }

  const campaigns = useApi(
    () =>
      api.listCampaignsV3({
        status: status === "all" ? undefined : status.toLowerCase(),
        creditor_id: creditorId || undefined,
        search: search || undefined,
        page,
        page_size: pageSize,
      }),
    [status, creditorId, search, page],
  );

  const creditors = useApi(() => api.listCreditors({ page_size: 100 }), []);

  const { connectionState } = useRealtimeRefresh(
    useMemo(
      () => ({
        campaigns: campaigns.refresh,
      }),
      [campaigns.refresh],
    ),
  );

  async function lifecycleAction(
    campaign: CampaignWithCounters,
    action: "pause" | "stop" | "resume" | "start",
  ) {
    setActing(true);
    try {
      if (action === "pause") await api.pauseCampaign(campaign.id);
      else if (action === "stop") await api.stopCampaign(campaign.id);
      else if (action === "resume") await api.resumeCampaign(campaign.id);
      else await api.startCampaign(campaign.id);
      toast.success(`Campaign ${action === "start" ? "started" : `${action}d`} successfully.`);
      campaigns.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Could not ${action} the campaign.`);
    } finally {
      setActing(false);
      setActionTarget(null);
    }
  }

  async function duplicate(campaign: CampaignWithCounters) {
    try {
      await api.duplicateCampaign(campaign.id);
      toast.success("Campaign duplicated as a draft.");
      campaigns.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not duplicate the campaign.");
    }
  }

  const data = campaigns.data;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Recovery Campaigns"
        description="Operational campaigns for AI-led recovery. Dialing is executed by the backend."
        actions={
          <>
            {allowed("export.create") ? (
              <Button variant="outline" onClick={() => toast.info("Choose a campaign's Exports tab to generate its report.")}>
                <Download className="size-4" />
                Export
              </Button>
            ) : null}
            {allowed("campaign.create") ? (
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus className="size-4" />
                  Create Campaign
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <>
                {connectionState === "LIVE" ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                    Live
                  </span>
                ) : null}
                <Button variant="ghost" size="sm" onClick={campaigns.refresh} aria-label="Refresh">
                  <RefreshCw className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data ? `${data.total} campaigns` : "Loading…"}
                </span>
              </>
            }
          >
            <Select
              value={status}
              onValueChange={(value) => {
                setPageParam("status", value === "all" ? "" : value);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={creditorId || "all"}
              onValueChange={(value) => setPageParam("creditor", value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-44" aria-label="Filter by creditor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All creditors</SelectItem>
                {(creditors.data?.items ?? []).map((creditor) => (
                  <SelectItem key={creditor.id} value={creditor.id}>
                    {creditor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchInput
              value={search}
              onChange={(value) => setPageParam("search", value)}
              placeholder="Search campaigns…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Attempted</TableHead>
                  <TableHead className="text-right">Connected</TableHead>
                  <TableHead className="text-right">Promised</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Disputed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.loading && !data ? (
                  <TableSkeleton rows={5} columns={11} />
                ) : campaigns.error ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <div className="p-4">
                        <ErrorState message={campaigns.error} onRetry={campaigns.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={11}
                    icon={Megaphone}
                    title="No campaigns match these filters"
                    description="Adjust the filters or create a new campaign."
                    action={
                      allowed("campaign.create") ? (
                        <Button size="sm" asChild>
                          <Link href="/campaigns/new">
                            <Plus className="size-4" />
                            Create Campaign
                          </Link>
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  data?.items.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        {campaign.description ? (
                          <p className="line-clamp-1 max-w-72 text-xs text-muted-foreground">
                            {campaign.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Phase3CampaignStatusBadge value={campaign.status} />
                      </TableCell>
                      <TableCell><Num value={campaign.total_leads} /></TableCell>
                      <TableCell><Num value={campaign.attempted_leads} /></TableCell>
                      <TableCell><Num value={campaign.connected_leads} /></TableCell>
                      <TableCell><Num value={campaign.promised_leads} /></TableCell>
                      <TableCell><Num value={campaign.paid_leads} /></TableCell>
                      <TableCell><Num value={campaign.disputed_leads} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(campaign.created_at)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(campaign.updated_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${campaign.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/campaigns/${campaign.id}`}>
                                <Pencil className="size-4" />
                                Open
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/campaigns/${campaign.id}/analytics`}>
                                <BarChart3 className="size-4" />
                                View analytics
                              </Link>
                            </DropdownMenuItem>
                            {allowed("campaign.update") ? (
                              <DropdownMenuItem onClick={() => void duplicate(campaign)}>
                                <Copy className="size-4" />
                                Duplicate
                              </DropdownMenuItem>
                            ) : null}
                            {allowed("export.create") ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/campaigns/${campaign.id}/exports`}>
                                  <Download className="size-4" />
                                  Export
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            {allowed("campaign.pause") &&
                            campaign.status.toLowerCase() === "running" ? (
                              <DropdownMenuItem
                                onClick={() => setActionTarget({ campaign, action: "pause" })}
                              >
                                <Pause className="size-4" />
                                Pause
                              </DropdownMenuItem>
                            ) : null}
                            {allowed("campaign.start") &&
                            ["draft", "ready", "paused", "stopped"].includes(
                              campaign.status.toLowerCase(),
                            ) ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  campaign.status.toLowerCase() === "paused"
                                    ? void lifecycleAction(campaign, "resume")
                                    : void lifecycleAction(campaign, "start")
                                }
                              >
                                <Play className="size-4" />
                                {campaign.status.toLowerCase() === "paused" ? "Resume" : "Start"}
                              </DropdownMenuItem>
                            ) : null}
                            {allowed("campaign.stop") &&
                            ["running", "paused"].includes(campaign.status.toLowerCase()) ? (
                              <DropdownMenuItem
                                onClick={() => setActionTarget({ campaign, action: "stop" })}
                              >
                                <Square className="size-4" />
                                Stop…
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={(next) => setPageParam("page", String(next))}
            disabled={campaigns.loading}
          />
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={actionTarget !== null}
        onOpenChange={(open) => (open ? null : setActionTarget(null))}
        title={actionTarget?.action === "stop" ? "Stop this campaign?" : "Pause this campaign?"}
        description={
          actionTarget?.action === "stop"
            ? `"${actionTarget?.campaign.name}" will stop dialing immediately. Leads keep their outcomes; the campaign cannot be resumed afterwards.`
            : `"${actionTarget?.campaign.name}" will pause dialing. You can resume it at any time.`
        }
        confirmLabel={actionTarget?.action === "stop" ? "Stop campaign" : "Pause campaign"}
        loading={acting}
        onConfirm={() => {
          if (actionTarget) void lifecycleAction(actionTarget.campaign, actionTarget.action);
        }}
      />
    </div>
  );
}
