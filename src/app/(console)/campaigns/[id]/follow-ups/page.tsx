"use client";

/**
 * Campaign Follow-ups tab (spec §21) — scheduled automated actions with
 * reschedule / cancel / retry controls, RBAC-gated.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarClock, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar } from "@/components/ops";
import { FollowUpStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { FollowUp } from "@/lib/types";

const STATUSES = ["SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "SKIPPED"];

export default function CampaignFollowUpsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [cancelTarget, setCancelTarget] = useState<FollowUp | null>(null);
  const [acting, setActing] = useState(false);

  const followUps = useApi(
    campaignId
      ? () =>
          api.listFollowUps({
            campaign_id: campaignId,
            status: status === "all" ? undefined : status,
            page,
            page_size: pageSize,
          })
      : null,
    [campaignId, status, page],
  );

  useRealtimeRefresh({ "follow-ups": followUps.refresh });

  const data = followUps.data ?? null;

  async function runReschedule() {
    if (!rescheduleTarget || !rescheduleAt) return;
    setActing(true);
    try {
      await api.updateFollowUp(rescheduleTarget.id, {
        scheduled_at: new Date(rescheduleAt).toISOString(),
      });
      toast.success("Follow-up rescheduled.");
      followUps.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reschedule.");
    } finally {
      setActing(false);
      setRescheduleTarget(null);
    }
  }

  async function runCancel() {
    if (!cancelTarget) return;
    setActing(true);
    try {
      await api.updateFollowUp(cancelTarget.id, { status: "CANCELLED" });
      toast.success("Follow-up cancelled.");
      followUps.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel.");
    } finally {
      setActing(false);
      setCancelTarget(null);
    }
  }

  async function retry(followUp: FollowUp) {
    try {
      await api.retryFollowUp(followUp.id);
      toast.success("Retry queued.");
      followUps.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not retry the action.");
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <FilterBar
          right={
            <span className="text-xs text-muted-foreground tabular-nums">
              {data ? `${data.total} follow-ups` : "Loading…"}
            </span>
          }
        >
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Scheduled at</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Last result</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUps.loading && !data ? (
                <TableSkeleton rows={6} columns={9} />
              ) : followUps.error ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="p-4">
                      <ErrorState message={followUps.error} onRetry={followUps.refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={9}
                  icon={CalendarClock}
                  title="No follow-ups scheduled"
                  description="Automated follow-up actions will appear here after calls produce outcomes."
                />
              ) : (
                data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.customer_name ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={`/accounts/${item.account_id}`} className="font-mono text-xs hover:underline">
                        {item.account_number ?? item.account_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{item.trigger.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-xs">{item.action.replaceAll("_", " ")}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(item.scheduled_at)}
                    </TableCell>
                    <TableCell><FollowUpStatusBadge value={item.status} /></TableCell>
                    <TableCell className="text-xs">{item.source ?? "automation"}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                      {item.last_result ?? "—"}
                    </TableCell>
                    <TableCell>
                      {allowed("recovery.manage") && ["SCHEDULED", "FAILED"].includes(item.status.toUpperCase()) ? (
                        <div className="flex items-center gap-1">
                          {item.status.toUpperCase() === "SCHEDULED" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRescheduleTarget(item);
                                setRescheduleAt(item.scheduled_at.slice(0, 16));
                              }}
                            >
                              <CalendarClock className="size-3.5" />
                              Reschedule
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => void retry(item)}>
                              <RefreshCw className="size-3.5" />
                              Retry
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setCancelTarget(item)}>
                            <X className="size-3.5" />
                            Cancel
                          </Button>
                        </div>
                      ) : null}
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
          onPageChange={setPage}
          disabled={followUps.loading}
        />
      </CardContent>

      <ConfirmActionDialog
        open={rescheduleTarget !== null}
        onOpenChange={(open) => (open ? null : setRescheduleTarget(null))}
        title="Reschedule follow-up"
        description={`Pick a new execution time for ${rescheduleTarget?.customer_name ?? "this customer"}'s follow-up.`}
        confirmLabel="Reschedule"
        destructive={false}
        loading={acting}
        onConfirm={() => void runReschedule()}
      >
        <div className="py-2">
          <Label htmlFor="reschedule-at">New date &amp; time</Label>
          <Input
            id="reschedule-at"
            type="datetime-local"
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
          />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => (open ? null : setCancelTarget(null))}
        title="Cancel this follow-up?"
        description="The scheduled action will not execute. This cannot be undone."
        confirmLabel="Cancel follow-up"
        loading={acting}
        onConfirm={() => void runCancel()}
      />
    </Card>
  );
}
