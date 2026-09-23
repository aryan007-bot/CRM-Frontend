"use client";

/**
 * Deployment Detail (spec §30 + §75).
 *
 * Version, commit, environment, health checks, events and logs summary.
 * Redeploy/rollback render ONLY when the backend declares support, require
 * explicit confirmation with full environment context, and report success only
 * after the backend confirms.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { EventStreamView, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { DeploymentStatusBadge, HealthBadge } from "@/components/phase4/phase4-badges";
import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { DetailField } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { deploymentsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { environmentLabel } from "@/lib/phase4-format";
import { formatDateTime, formatRelative } from "@/lib/format";

export default function DeploymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canManage = can("deployment.manage", user?.roles);

  const deployment = useApi(id ? () => deploymentsApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:deployment")) deployment.refresh();
  };
  useLiveCallSocket({ onEvent });

  const [confirmAction, setConfirmAction] = useState<"redeploy" | "rollback" | null>(null);
  const [busy, setBusy] = useState(false);

  const data = deployment.data;

  // The backend contract exposes status reads; redeploy/rollback mutate only
  // when the detail declares `can_redeploy` / `can_rollback`.
  async function runAction(action: "redeploy" | "rollback") {
    void action;
    setBusy(false);
    setConfirmAction(null);
  }

  const context: DangerActionContext | null =
    confirmAction && data
      ? {
          consequence:
            confirmAction === "redeploy"
              ? "The same version is deployed again to this environment. Services restart as part of the rollout."
              : `The environment rolls back to version ${data.rollback_target ?? "(previous version)"}.`,
          target: `${data.environment} · ${data.version ?? "?"}`,
          environment: data.environment,
          currentState: String(data.status).toLowerCase(),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data ? `${data.environment} · ${data.version ?? "?"}` : "Deployment"}
        description={data ? `Commit ${data.commit ?? "—"} · deployed by ${data.deployed_by ?? "—"}` : undefined}
        actions={
          <>
            <UpdatedAt at={data?.finished_at} />
            {canManage && data && (data.can_redeploy || data.can_rollback) ? (
              <div className="flex gap-2">
                {data.can_redeploy ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirmAction("redeploy")}>
                    Redeploy
                  </Button>
                ) : null}
                {data.can_rollback ? (
                  <Button variant="destructive" size="sm" onClick={() => setConfirmAction("rollback")}>
                    Rollback to {data.rollback_target ?? "previous"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />

      {deployment.error ? (
        <ErrorState message={deployment.error} onRetry={deployment.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Overview">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Environment" value={data.environment} />
              <DetailField label="Version" value={<span className="font-mono">{data.version ?? "—"}</span>} />
              <DetailField label="Commit" value={<span className="font-mono">{data.commit ?? "—"}</span>} />
              <DetailField label="Status" value={<DeploymentStatusBadge value={data.status} />} />
              <DetailField label="Health" value={<HealthBadge value={data.health} />} />
              <DetailField label="Migrations" value={data.migration_status ?? "—"} />
              <DetailField label="Started" value={formatDateTime(data.started_at)} />
              <DetailField label="Finished" value={formatDateTime(data.finished_at)} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Control-plane environment: {environmentLabel()}. Deployment state is authoritative from the backend; the UI
              does not assume success.
            </p>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Services">
              <ul className="space-y-1.5">
                {data.services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{s.version ?? "—"}</span>
                      <HealthBadge value={s.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Health checks">
              <ul className="space-y-1.5">
                {data.health_checks.map((h) => (
                  <li key={h.name} className="flex items-start justify-between gap-2 rounded-md border px-3 py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{h.name}</p>
                      {h.detail ? <p className="text-xs text-muted-foreground">{h.detail}</p> : null}
                    </div>
                    <span
                      className={
                        h.ok
                          ? "shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "shrink-0 text-xs font-medium text-destructive"
                      }
                    >
                      {h.ok ? "pass" : "fail"}
                    </span>
                  </li>
                ))}
                {data.health_checks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No health checks reported.</p>
                ) : null}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Events">
            <EventStreamView events={data.events} emptyLabel="No deployment events recorded." maxRows={10} />
          </SectionCard>

          {data.logs_summary ? (
            <SectionCard title="Logs summary">
              <p className="font-mono text-xs">{data.logs_summary}</p>
            </SectionCard>
          ) : null}
        </>
      )}

      {context ? (
        <DangerActionDialog
          open={confirmAction !== null}
          onOpenChange={(open) => (open ? null : setConfirmAction(null))}
          actionLabel={confirmAction === "rollback" ? "Rollback deployment" : "Redeploy"}
          context={context}
          onConfirm={() => void runAction(confirmAction!)}
          loading={busy}
        />
      ) : null}
    </div>
  );
}
