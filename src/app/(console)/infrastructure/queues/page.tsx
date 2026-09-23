"use client";

/**
 * Queue Management (spec §9).
 *
 * Renders whatever queues the backend reports — deployments differ, so nothing
 * assumes a fixed queue set. Backlog columns come from backend metrics.
 */

import Link from "next/link";
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { UpdatedAt } from "@/components/phase4/phase4-parts";
import { QueueStateBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { queuesApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount, formatRelative } from "@/lib/format";

export default function QueuesPage() {
  const queues = useApi(() => queuesApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:queues")) queues.refresh();
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const data = queues.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Queues"
        description="Job queues with live backlog metrics. The set of queues depends on the deployment."
        actions={<UpdatedAt at={data[0]?.updated_at} />}
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Running</TableHead>
                  <TableHead className="text-right">Retry</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Dead-letter</TableHead>
                  <TableHead className="text-right">Throughput</TableHead>
                  <TableHead>Oldest job</TableHead>
                  <TableHead className="text-right">Workers</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.loading && !queues.data ? (
                  <TableSkeleton rows={7} columns={12} />
                ) : queues.error ? (
                  <TableMessage
                    columns={12}
                    icon={Workflow}
                    title="Queue metrics are temporarily unavailable"
                    description={queues.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={12}
                    icon={Workflow}
                    title="No queues registered."
                    description="Queues appear once the backend reports them."
                  />
                ) : (
                  data.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link
                          href={`/infrastructure/queues/${q.id}`}
                          className="font-mono text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {q.name}
                        </Link>
                      </TableCell>
                      <TableCell><QueueStateBadge value={q.state} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.pending)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.running)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.retry)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.failed)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.dead_letter)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.throughput)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(q.metrics.oldest_job_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(q.metrics.worker_count)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(q.metrics.last_activity_at)}</TableCell>
                      <TableCell><ScopeBadge scope={q.scope} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {connectionState !== "LIVE" ? (
        <p className="text-xs text-muted-foreground">Realtime connection interrupted — showing last known data.</p>
      ) : null}
    </div>
  );
}
