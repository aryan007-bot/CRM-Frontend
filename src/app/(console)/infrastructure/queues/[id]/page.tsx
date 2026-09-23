"use client";

/**
 * Queue Detail (spec §10).
 *
 * Sections: overview, backlog trend, actions (only backend-supported ones),
 * and recent events. Filters persist in the URL where useful.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { SectionCard, StackedCounts, UpdatedAt } from "@/components/phase4/phase4-parts";
import { QueueStateBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { DetailField } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { queuesApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { environmentLabel } from "@/lib/phase4-format";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";

type QueueAction = "pause" | "resume" | "retry_failed";

const ACTION_CONSEQUENCES: Record<QueueAction, string> = {
  pause: "The queue stops dispatching jobs. Pending jobs wait until the queue is resumed.",
  resume: "The queue resumes dispatching pending jobs to available workers.",
  retry_failed: "All currently failed jobs in this queue are re-enqueued for another attempt.",
};

const ACTION_LABELS: Record<QueueAction, string> = {
  pause: "Pause queue",
  resume: "Resume queue",
  retry_failed: "Retry failed jobs",
};

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canManage = can("queue.manage", user?.roles);

  const queue = useApi(id ? () => queuesApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:queue")) queue.refresh();
  };
  useLiveCallSocket({ onEvent });

  const [pending, setPending] = useState<QueueAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = queue.data;

  async function runAction(action: QueueAction) {
    if (!id) return;
    setBusy(true);
    try {
      await queuesApi.action(id, action);
      toast.success(`Queue ${action.replace("_", " ")} requested.`);
      queue.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setPending(null);
    }
  }

  function openConfirm(action: QueueAction) {
    setPending(action);
    setConfirmOpen(true);
  }

  const context: DangerActionContext | null =
    pending && data
      ? {
          consequence: ACTION_CONSEQUENCES[pending],
          target: data.name,
          environment: environmentLabel(),
          currentState: data.state,
        }
      : null;

  const m = data?.metrics;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.name ?? "Queue"}
        description={data ? `Job queue · ${String(data.queue_type ?? "general")}` : undefined}
        actions={
          <>
            <UpdatedAt at={data?.updated_at} />
            {canManage && data ? (
              <div className="flex flex-wrap gap-2">
                {data.supported_actions.includes("pause") && data.state === "ACTIVE" ? (
                  <Button variant="outline" size="sm" onClick={() => openConfirm("pause")}>
                    Pause
                  </Button>
                ) : null}
                {data.supported_actions.includes("resume") && data.state === "PAUSED" ? (
                  <Button variant="outline" size="sm" onClick={() => openConfirm("resume")}>
                    Resume
                  </Button>
                ) : null}
                {data.supported_actions.includes("retry_failed") && (m?.failed ?? 0) > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => openConfirm("retry_failed")}>
                    Retry failed ({m?.failed})
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />

      {queue.error ? (
        <ErrorState message={queue.error} onRetry={queue.refresh} />
      ) : !data || !m ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Overview">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Status" value={<QueueStateBadge value={data.state} />} />
              <DetailField label="Scope" value={<ScopeBadge scope={data.scope} />} />
              <DetailField label="Workers" value={m.worker_count ?? "—"} />
              <DetailField label="Throughput" value={m.throughput !== null ? `${m.throughput}/min` : "—"} />
              <DetailField label="Oldest job" value={formatRelative(m.oldest_job_at)} />
              <DetailField label="Last activity" value={formatRelative(m.last_activity_at)} />
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold">Job distribution</p>
              <StackedCounts
                entries={[
                  { label: "Pending", value: m.pending, tone: "info" },
                  { label: "Running", value: m.running, tone: "success" },
                  { label: "Retry", value: m.retry, tone: "warning" },
                  { label: "Failed", value: m.failed, tone: "danger" },
                  { label: "Dead-letter", value: m.dead_letter, tone: "danger" },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Backlog history" description="Pending jobs over the reported window.">
            {data.backlog_history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No backlog history reported.</p>
            ) : (
              <TrendList history={data.backlog_history} />
            )}
          </SectionCard>
        </>
      )}

      {context ? (
        <DangerActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          actionLabel={pending ? ACTION_LABELS[pending] : "Confirm"}
          context={context}
          onConfirm={() => void runAction(pending!)}
          loading={busy}
        />
      ) : null}
    </div>
  );
}

/** Compact textual trend — exact values stay visible without a chart lib. */
function TrendList({ history }: { history: { at: string; value: number | null }[] }) {
  const max = Math.max(...history.map((h) => h.value ?? 0), 1);
  const recent = history.slice(-30);
  return (
    <div>
      <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Backlog trend">
        {recent.map((h) => (
          <div
            key={h.at}
            title={`${formatDateTime(h.at)}: ${h.value ?? 0}`}
            className="flex-1 rounded-t-sm bg-sky-500/70"
            style={{ height: `${Math.max(2, ((h.value ?? 0) / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Newest on the right · max {max} pending in window
      </p>
    </div>
  );
}
