"use client";

/**
 * Model Detail (spec §19).
 *
 * Configuration, health, performance, provider and recent errors. Configuration
 * is displayed read-only unless the backend supports mutations for it.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { HealthBadge, RoutingRoleBadge } from "@/components/phase4/phase4-badges";
import { DetailField } from "@/components/ops";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { modelsApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount, formatDateTime, formatRelative } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const model = useApi(id ? () => modelsApi.get(id) : null, [id]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:model")) model.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = model.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={data?.name ?? "Model"}
        description={data ? `${data.model_type} · ${data.provider_name ?? "unknown provider"}` : undefined}
        actions={<UpdatedAt at={null} />}
      />

      {model.error ? (
        <ErrorState message={model.error} onRetry={model.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Overview">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Enabled" value={data.enabled ? "yes" : "no"} />
              <DetailField label="Availability" value={<HealthBadge value={data.availability} />} />
              <DetailField label="Fallback role" value={<RoutingRoleBadge value={data.fallback_role} />} />
              <DetailField label="Routing priority" value={data.routing_priority ?? "—"} />
              <DetailField
                label="Provider"
                value={
                  <Link href={`/ai/providers/${data.provider_id}`} className="underline-offset-4 hover:underline">
                    {data.provider_name ?? data.provider_id}
                  </Link>
                }
              />
              <DetailField label="Context limit" value={data.context_limit !== null ? formatCount(data.context_limit) : "—"} />
              <DetailField label="Streaming" value={data.streaming === null || data.streaming === undefined ? "—" : data.streaming ? "yes" : "no"} />
              <DetailField label="Function calling" value={data.function_calling === null || data.function_calling === undefined ? "—" : data.function_calling ? "yes" : "no"} />
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Performance">
              <div className="space-y-2">
                <p className="text-sm">Latency: <LatencyStat stats={data.latency} className="text-sm" /></p>
                <p className="text-sm">Error rate: {data.error_rate !== null ? formatPercent(data.error_rate) : "—"}</p>
                <p className="text-sm">Usage: {formatCount(data.usage_count)} requests</p>
              </div>
            </SectionCard>

            <SectionCard title="Configuration" description="Backend-managed configuration values.">
              {data.configuration && Object.keys(data.configuration).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(data.configuration).map(([key, value]) => (
                    <DetailField key={key} label={key.replace(/_/g, " ")} value={String(value)} mono />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No configuration reported for this model.</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent errors">
            {data.recent_errors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No errors recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.recent_errors.map((e) => (
                  <li key={e.id} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{e.code ?? "ERROR"}</span>
                      <span className="text-[11px] text-muted-foreground">{formatRelative(e.occurred_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.message ?? "No detail."}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Audit">
            <ul className="space-y-1.5">
              {data.audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground">{formatDateTime(a.at)}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted-foreground">
                    by {a.actor ?? "system"}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </span>
                </li>
              ))}
              {data.audit.length === 0 ? <p className="text-xs text-muted-foreground">No audit entries.</p> : null}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
