"use client";

/**
 * Worker Detail (spec §8).
 *
 * Health, current/recent jobs, throughput, heartbeat history and resource
 * metrics — only metrics the backend actually returns. Control actions
 * (drain/resume/restart/disable) require `worker.manage` and a confirmed,
 * backend-mediated mutation (spec §46).
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import {
  HeartbeatStrip,
  LatencyStat,
  ResourceMeterList,
  SectionCard,
  UpdatedAt,
} from "@/components/phase4/phase4-parts";
import { ScopeBadge, WorkerStatusBadge } from "@/components/phase4/phase4-badges";
import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { DetailField } from "@/components/ops";
import { Button } from "@/components/ui/button";
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
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { workersApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { environmentLabel } from "@/lib/phase4-format";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";

type WorkerAction = "drain" | "resume" | "restart" | "disable";

const ACTION_CONSEQUENCES: Record<WorkerAction, string> = {
  drain: "The worker stops accepting new jobs and finishes its current ones before stopping.",
  resume: "The worker resumes accepting jobs from its queues.",
  restart: "The worker process restarts. In-flight jobs are drained first where supported.",
  disable: "The worker is disabled and will not pick up jobs until re-enabled.",
};

export default function WorkerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canManage = can("worker.manage", user?.roles);

  const worker = useApi(id ? () => workersApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:worker")) worker.refresh();
  };
  useLiveCallSocket({ onEvent });

  const [pending, setPending] = useState<WorkerAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = worker.data;

  async function runAction(action: WorkerAction) {
    if (!id) return;
    setBusy(true);
    try {
      await workersApi.action(id, action);
      toast.success(`Worker ${action} requested. The backend reports the new state when applied.`);
      worker.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setPending(null);
    }
  }

  function openConfirm(action: WorkerAction) {
    setPending(action);
    setConfirmOpen(true);
  }

  const context: DangerActionContext | null =
    pending && data
      ? {
          consequence: ACTION_CONSEQUENCES[pending],
          target: data.name,
          environment: environmentLabel(),
          currentState: data.status,
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.name ?? "Worker"}
        description={data ? `${data.worker_type} worker · ${data.host ?? "unknown host"}` : undefined}
        actions={
          <>
            <UpdatedAt at={data?.updated_at} />
            {canManage && data ? (
              <div className="flex flex-wrap gap-2">
                {data.status === "HEALTHY" ? (
                  <Button variant="outline" size="sm" onClick={() => openConfirm("drain")}>
                    Drain
                  </Button>
                ) : data.status === "DRAINING" || data.status === "DEGRADED" ? (
                  <Button variant="outline" size="sm" onClick={() => openConfirm("resume")}>
                    Resume
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => openConfirm("restart")}>
                  Restart
                </Button>
                {data.status !== "STOPPED" ? (
                  <Button variant="destructive" size="sm" onClick={() => openConfirm("disable")}>
                    Disable
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />

      {worker.error ? (
        <ErrorState message={worker.error} onRetry={worker.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Health">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Status" value={<WorkerStatusBadge value={data.status} />} />
              <DetailField label="Version" value={<span className="font-mono">{data.version ?? "—"}</span>} />
              <DetailField label="Region" value={data.region ?? "—"} />
              <DetailField label="Scope" value={<ScopeBadge scope={data.scope} />} />
              <DetailField label="Concurrency" value={data.concurrency ?? "—"} />
              <DetailField label="Throughput (window)" value={data.throughput ?? "—"} />
              <DetailField label="Failures" value={data.failures ?? "—"} />
              <DetailField label="Retries" value={data.retry_count ?? "—"} />
              <DetailField label="Latency" value={<LatencyStat stats={data.latency} />} />
              <DetailField label="Started" value={formatDateTime(data.started_at)} />
              <DetailField label="Last heartbeat" value={formatRelative(data.last_heartbeat_at)} />
              <DetailField label="Updated" value={formatRelative(data.updated_at)} />
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold">Heartbeat history</p>
              <HeartbeatStrip history={data.heartbeat_history} />
            </div>
          </SectionCard>

          <SectionCard title="Resource metrics" description="Only metrics reported by the backend are shown.">
            <ResourceMeterList resources={data.resources} />
          </SectionCard>

          <SectionCard title="Current jobs" description="Jobs executing on this worker right now.">
            {data.current_jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs are running.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.current_jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">{j.id}</TableCell>
                      <TableCell className="text-xs">{j.job_type ?? "—"}</TableCell>
                      <TableCell className="text-xs">{j.queue ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(j.started_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title="Recent jobs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.id}</TableCell>
                    <TableCell className="text-xs">{j.job_type ?? "—"}</TableCell>
                    <TableCell className="text-xs">{j.status ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelative(j.started_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </>
      )}

      {context ? (
        <DangerActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          actionLabel={`Confirm: ${pending}`}
          context={context}
          onConfirm={() => void runAction(pending!)}
          loading={busy}
        />
      ) : null}
    </div>
  );
}
