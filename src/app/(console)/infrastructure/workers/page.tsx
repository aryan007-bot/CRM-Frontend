"use client";

/**
 * Worker Management (spec §7).
 *
 * The table renders backend worker state; management actions render only when
 * the user holds `worker.manage` and always go through the backend API.
 */

import Link from "next/link";
import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { UpdatedAt } from "@/components/phase4/phase4-parts";
import { ScopeBadge, WorkerStatusBadge } from "@/components/phase4/phase4-badges";
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
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { workersApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatRelative } from "@/lib/format";

export default function WorkersPage() {
  const { user } = useAuth();
  const canManage = can("worker.manage", user?.roles);

  const workers = useApi(() => workersApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:workers")) workers.refresh();
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const data = workers.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Workers"
        description="Background worker pool: status, capacity and heartbeats. The backend owns all worker lifecycle."
        actions={<UpdatedAt at={data[0]?.updated_at} />}
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Concurrency</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Queued</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Last heartbeat</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.loading && !workers.data ? (
                  <TableSkeleton rows={7} columns={13} />
                ) : workers.error ? (
                  <TableMessage
                    columns={13}
                    icon={Cpu}
                    title="Worker status is unavailable"
                    description={workers.error}
                  />
                ) : data.length === 0 ? (
                  <TableMessage
                    columns={13}
                    icon={Cpu}
                    title="No workers registered."
                    description="Workers appear here once the backend registers them."
                  />
                ) : (
                  data.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link
                          href={`/infrastructure/workers/${w.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {w.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{w.worker_type}</TableCell>
                      <TableCell><WorkerStatusBadge value={w.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{w.version ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{w.host ?? "—"}</TableCell>
                      <TableCell className="text-xs">{w.region ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.concurrency ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.active_jobs ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.queued_jobs ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.failed_jobs ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(w.last_heartbeat_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(w.started_at)}</TableCell>
                      <TableCell><ScopeBadge scope={w.scope} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          You have view-only access to workers. Management actions are hidden.
        </p>
      ) : null}
      {connectionState !== "LIVE" ? (
        <p className="text-xs text-muted-foreground">Realtime connection interrupted — showing last known data.</p>
      ) : null}
    </div>
  );
}
