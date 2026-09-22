"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CampaignStatusBadge } from "@/components/status-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatRelative, percent } from "@/lib/format";
import { campaignStats } from "@/lib/mock-data";
import type { Campaign } from "@/lib/types";
import { CampaignDialog } from "./campaign-dialog";

function weekdayLabel(days: Campaign["schedule"]["days"]): string {
  const all = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  if (days.length === 5 && (["mon", "tue", "wed", "thu", "fri"] as const).every((d) => days.includes(d))) {
    return "Mon–Fri";
  }
  if (days.length === 7) return "Every day";
  return all
    .filter((d) => days.includes(d))
    .map((d) => d[0].toUpperCase() + d.slice(1, 2))
    .join(", ");
}

// Small helpers reading deterministic per-campaign stats for the table.
// (FastAPI will replace these with GET /campaigns?include=stats.)
function hourLabel(h: number): string {
  return `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
}

function campaignStatsConnect(id: string) {
  return campaignStats(id).connectRate;
}
function campaignStatsAI(id: string) {
  return campaignStats(id).aiResolutionRate;
}
function campaignStatsPromise(id: string) {
  return campaignStats(id).promiseRate;
}

export default function CampaignsPage() {
  const campaigns = useApi(() => api.listCampaigns(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleStatus(campaign: Campaign) {
    const next =
      campaign.status === "active"
        ? "paused"
        : campaign.status === "paused" || campaign.status === "draft"
          ? "active"
          : campaign.status;
    setBusyId(campaign.id);
    try {
      await api.updateCampaign(campaign.id, { status: next });
      toast.success(
        next === "active" ? "Campaign is now dialing." : "Campaign paused.",
      );
      await campaigns.refresh();
    } catch {
      toast.error("Could not update the campaign.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.deleteCampaign(deleting.id);
      toast.success("Campaign deleted.");
      await campaigns.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Campaigns"
        description="Outbound recovery campaigns — dial modes, schedules, and throughput."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {campaigns.error ? (
        <p className="py-16 text-center text-sm text-destructive">{campaigns.error}</p>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Connect</TableHead>
                  <TableHead className="text-right">AI res.</TableHead>
                  <TableHead className="text-right">Promise</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={10}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : campaigns.data?.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="max-w-72 truncate text-xs text-muted-foreground">
                            {campaign.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <CampaignStatusBadge status={campaign.status} />
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {campaign.dialMode}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {weekdayLabel(campaign.schedule.days)} ·{" "}
                          {hourLabel(campaign.schedule.startHour)}–
                          {hourLabel(campaign.schedule.endHour)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {campaign.concurrency}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(campaignStatsConnect(campaign.id))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(campaignStatsAI(campaign.id))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(campaignStatsPromise(campaign.id))}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatRelative(campaign.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busyId === campaign.id}
                                aria-label={`Actions for ${campaign.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={
                                  campaign.status === "completed" || busyId === campaign.id
                                }
                                onClick={() => toggleStatus(campaign)}
                              >
                                {campaign.status === "active" ? (
                                  <>
                                    <Pause className="size-4" /> Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="size-4" /> Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(campaign);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={campaign.status === "active"}
                                onClick={() => setDeleting(campaign)}
                              >
                                <Trash2 className="size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                {!campaigns.loading && campaigns.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <p className="text-sm font-medium">No campaigns yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a draft, add contacts, then activate.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        onSaved={() => campaigns.refresh()}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the campaign and its queue. Call history is kept for
              compliance. Active campaigns cannot be deleted — pause first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
