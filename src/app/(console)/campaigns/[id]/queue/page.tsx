"use client";

/**
 * Campaign Queue tab — the campaign-scoped slice of the recovery queue.
 * The backend controls queue state; the UI displays and requests actions only.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { FilterBar } from "@/components/ops";
import { OutcomeBadge, QueueStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const QUEUE_STATUSES = [
  "PENDING",
  "READY",
  "IN_PROGRESS",
  "CALLBACK",
  "FOLLOW_UP",
  "PAUSED",
  "COMPLETED",
  "ESCALATED",
  "CLOSED",
];

export default function CampaignQueuePage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const queue = useApi(
    campaignId
      ? () =>
          api.listRecoveryQueue({
            campaign_id: campaignId,
            status: status === "all" ? undefined : status,
            page,
            page_size: pageSize,
          })
      : null,
    [campaignId, status, page],
  );

  const { connectionState } = useRealtimeRefresh({
    queue: queue.refresh,
  });

  const data = queue.data ?? null;

  async function pauseItem(itemId: string) {
    try {
      await api.recoveryQueueAction("pause", [itemId]);
      toast.success("Queue item paused.");
      queue.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not pause the item.");
    }
  }

  async function resumeItem(itemId: string) {
    try {
      await api.recoveryQueueAction("resume", [itemId]);
      toast.success("Queue item resumed.");
      queue.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not resume the item.");
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <FilterBar
          right={
            connectionState === "LIVE" ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                Live
              </span>
            ) : null
          }
        >
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40" aria-label="Filter by queue status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {QUEUE_STATUSES.map((s) => (
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
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Next attempt</TableHead>
                <TableHead>Last outcome</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.loading && !data ? (
                <TableSkeleton rows={6} columns={10} />
              ) : queue.error ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <div className="p-4">
                      <ErrorState message={queue.error} onRetry={queue.refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={10}
                  icon={ListOrdered}
                  title="Queue is empty"
                  description="Add leads and start the campaign to populate the dialing queue."
                />
              ) : (
                data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">
                      {item.customer_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/accounts/${item.account_id}`} className="font-mono text-xs hover:underline">
                        {item.account_number ?? item.account_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.outstanding_amount ? formatMoney(item.outstanding_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.priority}</TableCell>
                    <TableCell className="text-xs">{item.next_action ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.next_attempt_at ? formatDateTime(item.next_attempt_at) : "—"}
                    </TableCell>
                    <TableCell><OutcomeBadge value={item.last_outcome} /></TableCell>
                    <TableCell className="text-right tabular-nums">{item.attempts}</TableCell>
                    <TableCell><QueueStatusBadge value={item.status} /></TableCell>
                    <TableCell>
                      {allowed("recovery.manage") && ["PAUSED", "READY", "PENDING"].includes(item.status.toUpperCase()) ? (
                        item.status.toUpperCase() === "PAUSED" ? (
                          <Button variant="ghost" size="sm" onClick={() => void resumeItem(item.id)}>
                            Resume
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => void pauseItem(item.id)}>
                            Pause
                          </Button>
                        )
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
          disabled={queue.loading}
        />
      </CardContent>
    </Card>
  );
}
