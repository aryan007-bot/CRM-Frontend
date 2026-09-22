"use client";

/**
 * Recovery Queue (spec §11) — the operational work queue. The backend owns
 * queue state and dialing; the UI displays state and requests allowed actions.
 */

import { useState } from "react";
import Link from "next/link";
import { ListOrdered, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { FilterBar, SearchInput } from "@/components/ops";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

export default function RecoveryQueuePage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const queue = useApi(
    () =>
      api.listRecoveryQueue({
        status: status === "all" ? undefined : status,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, debounced, page],
  );

  const { connectionState } = useRealtimeRefresh({ queue: queue.refresh });

  const data = queue.data ?? null;

  async function act(action: "pause" | "resume", itemId: string) {
    try {
      await api.recoveryQueueAction(action, [itemId]);
      toast.success(`Queue item ${action}d.`);
      queue.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Recovery Queue</h1>
        <p className="text-sm text-muted-foreground">
          Live operational queue across campaigns. The backend dialer advances items; you can
          pause or resume them.
        </p>
      </header>

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
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data ? `${data.total} items` : "Loading…"}
                </span>
              </>
            }
          >
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {QUEUE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search customer or account…"
            />
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
                  <TableHead>Strategy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.loading && !data ? (
                  <TableSkeleton rows={8} columns={11} />
                ) : queue.error ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <div className="p-4">
                        <ErrorState message={queue.error} onRetry={queue.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={11}
                    icon={ListOrdered}
                    title="The queue is empty"
                    description="Leads enter the queue when a campaign starts dialing."
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
                      <TableCell className="text-xs">{item.strategy ?? "—"}</TableCell>
                      <TableCell><QueueStatusBadge value={item.status} /></TableCell>
                      <TableCell>
                        {allowed("recovery.manage") ? (
                          item.status.toUpperCase() === "PAUSED" ? (
                            <Button variant="ghost" size="icon" aria-label="Resume" onClick={() => void act("resume", item.id)}>
                              <Play className="size-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" aria-label="Pause" onClick={() => void act("pause", item.id)}>
                              <Pause className="size-4" />
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
    </div>
  );
}
