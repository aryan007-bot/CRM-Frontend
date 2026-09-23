"use client";

/**
 * Performance dashboard (spec §37 + §38).
 *
 * Latency aggregates (avg/p50/p95/p99 when supplied) come from backend
 * aggregation over the selected timeframe — the browser never computes P95
 * from partial samples. Includes the AI pipeline stage breakdown.
 */

import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { performanceApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { TIMEFRAMES, type Timeframe } from "@/lib/phase4-realtime";
import { formatMs } from "@/lib/phase4-format";
import { formatCount } from "@/lib/format";
import type { PerformanceMetric } from "@/lib/phase4-types";

const GROUP_TITLES: Record<PerformanceMetric["category"], string> = {
  api: "API",
  database: "Database",
  queue: "Queues",
  worker: "Workers",
  telephony: "Telephony",
  ai: "AI services",
};

export default function PerformancePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const perf = useApi(() => performanceApi.get(timeframe), [timeframe]);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:performance")) perf.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = perf.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Performance"
        description="Backend-aggregated latency across the platform. Percentiles are computed server-side."
        actions={
          <>
            <UpdatedAt at={data?.updated_at} />
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-28" aria-label="Timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {perf.error ? (
        <ErrorState message={perf.error} onRetry={perf.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {(["api", "database", "queue", "worker", "telephony", "ai"] as const)
            .map((category) => ({
              category,
              metrics: data.metrics.filter((m) => m.category === category),
            }))
            .filter((group) => group.metrics.length > 0)
            .map((group) => (
              <SectionCard key={group.category} title={GROUP_TITLES[group.category]}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Metric</th>
                        <th className="pb-2 pr-4 font-medium">Average</th>
                        <th className="pb-2 pr-4 font-medium">P50</th>
                        <th className="pb-2 pr-4 font-medium">P95</th>
                        <th className="pb-2 font-medium">P99</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.metrics.map((m) => (
                        <tr key={m.key} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{m.label}</td>
                          <td className="py-2 pr-4 tabular-nums">{formatMs(m.latency.avg_ms)}</td>
                          <td className="py-2 pr-4 tabular-nums">{formatMs(m.latency.p50_ms)}</td>
                          <td className="py-2 pr-4 tabular-nums">{formatMs(m.latency.p95_ms)}</td>
                          <td className="py-2 tabular-nums">{formatMs(m.latency.p99_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ))}

          {data.ai_pipeline ? (
            <SectionCard
              title="AI pipeline latency breakdown"
              description="Audio In → VAD → STT → LLM → TTS → Audio Out. Shows where conversation latency originates."
            >
              <div className="space-y-3">
                {data.ai_pipeline.map((stage) => (
                  <div key={stage.stage} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{stage.stage}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <LatencyStat stats={stage.latency} />
                        {stage.queue_wait_ms !== null && stage.queue_wait_ms !== undefined ? (
                          <span className="text-muted-foreground">
                            queue wait {formatMs(stage.queue_wait_ms)}
                          </span>
                        ) : null}
                        {stage.processing_ms !== null && stage.processing_ms !== undefined ? (
                          <span className="text-muted-foreground">
                            processing {formatMs(stage.processing_ms)}
                          </span>
                        ) : null}
                        {stage.errors ? (
                          <span className="font-medium text-destructive">{formatCount(stage.errors)} errors</span>
                        ) : null}
                      </div>
                    </div>
                    <Bar
                      value={stage.latency.avg_ms ?? 0}
                      p95={stage.latency.p95_ms ?? null}
                      max={Math.max(
                        ...data.ai_pipeline!.map((s) => s.latency.p95_ms ?? s.latency.avg_ms ?? 0),
                        1,
                      )}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : (
            <p className="text-xs text-muted-foreground">AI pipeline breakdown is not reported for this deployment.</p>
          )}
        </>
      )}
    </div>
  );
}

function Bar({ value, p95, max }: { value: number; p95: number | null; max: number }) {
  const avgPct = Math.max(2, Math.min(100, (value / max) * 100));
  const p95Pct = p95 !== null ? Math.max(2, Math.min(100, (p95 / max) * 100)) : null;
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${avgPct}%` }} />
      </div>
      {p95Pct !== null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-sky-300" style={{ width: `${p95Pct}%` }} />
        </div>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        avg {formatMs(value)}
        {p95Pct !== null ? ` · p95 ${formatMs(p95)}` : ""}
      </p>
    </div>
  );
}
