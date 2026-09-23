"use client";

/**
 * AI Infrastructure Overview (spec §15).
 *
 * Gateway, providers, services, routing and quota utilization at a glance.
 * All values are backend-reported; optional metrics render only when present.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, StackedCounts, UpdatedAt, UtilizationBar } from "@/components/phase4/phase4-parts";
import { HealthBadge, ProviderStatusBadge } from "@/components/phase4/phase4-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { aiInfraApi, providersApi, routingApi, usageApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";

export default function AIInfrastructurePage() {
  const overview = useApi(() => aiInfraApi.overview(), []);
  const providers = useApi(() => providersApi.list(), []);
  const routing = useApi(() => routingApi.overview(), []);
  const usage = useApi(() => usageApi.get({}), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).some((t) => ["phase4:ai-infra", "phase4:providers", "phase4:routing"].includes(t))) {
      overview.refresh();
      providers.refresh();
      routing.refresh();
      usage.refresh();
    }
  };
  useLiveCallSocket({ onEvent });

  const providerData = providers.data ?? [];
  const usageData = usage.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="AI Infrastructure"
        description="Gateway, providers, routing and quota utilization. All metrics are backend-reported."
        actions={<UpdatedAt at={usage.data ? new Date().toISOString() : null} />}
      />

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={overview.refresh} />
      ) : overview.loading && !overview.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      <SectionCard
        title="Providers"
        description="Registered AI providers across LLM, STT, TTS and VAD."
        actions={
          <Link href="/ai/providers" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Manage providers
          </Link>
        }
      >
        {providers.loading && !providers.data ? (
          <Skeleton className="h-32 w-full" />
        ) : providers.error ? (
          <p className="text-xs text-muted-foreground">Provider health unavailable: {providers.error}</p>
        ) : providerData.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4" aria-hidden /> No providers registered.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providerData.map((p) => (
              <Link
                key={p.id}
                href={`/ai/providers/${p.id}`}
                className="rounded-lg border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <ProviderStatusBadge value={p.status} />
                </div>
                <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  <p>{p.provider_type} · priority {p.priority ?? "—"}</p>
                  <p>
                    {formatCount(p.requests)} requests · {formatCount(p.errors)} errors
                  </p>
                  <p>Latency: <LatencyStat stats={p.latency} /></p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Routing chain"
          description="Current primary and fallback order."
          actions={
            <Link href="/ai/routing" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Open routing
            </Link>
          }
        >
          {routing.error ? (
            <p className="text-xs text-muted-foreground">Routing unavailable: {routing.error}</p>
          ) : routing.loading && !routing.data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ol className="space-y-1.5">
              {(routing.data?.chain ?? []).map((step) => (
                <li key={step.position} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <span className="font-mono text-[10px] text-muted-foreground">#{step.position}</span>
                  <span className="font-medium">{step.provider_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">/ {step.model_name ?? "—"}</span>
                  <span className="ml-auto"><HealthBadge value={step.state} /></span>
                </li>
              ))}
              {(routing.data?.chain ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No routing chain reported.</p>
              ) : null}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Quota utilization" description="Backend-configured quotas and current usage.">
          {(usageData?.rows ?? []).filter((r) => r.quota).length === 0 ? (
            <p className="text-xs text-muted-foreground">No quotas reported.</p>
          ) : (
            <div className="space-y-3">
              {(usageData?.rows ?? [])
                .filter((r) => r.quota)
                .map((r) => (
                  <UtilizationBar
                    key={r.provider_id}
                    label={`${r.provider_name ?? r.provider_id}${r.quota?.unit ? ` (${r.quota.unit})` : ""}`}
                    used={r.quota?.used ?? null}
                    limit={r.quota?.limit ?? null}
                    hint={
                      r.quota?.reset_at
                        ? `Resets ${new Date(r.quota.reset_at).toLocaleString("en-GB")}`
                        : r.fallback_count
                          ? `${formatCount(r.fallback_count)} fallbacks`
                          : null
                    }
                  />
                ))}
            </div>
          )}
        </SectionCard>
      </div>

      {usageData ? (
        <SectionCard title="Request distribution" description="Requests per provider in the current window.">
          <StackedCounts
            entries={(usageData.requests_by_provider ?? []).map((r) => ({
              label: r.label,
              value: r.value,
              tone: "info" as const,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Fallback rate:{" "}
            {usageData.fallback_rate !== null && usageData.fallback_rate !== undefined
              ? formatPercent(usageData.fallback_rate)
              : "—"}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
