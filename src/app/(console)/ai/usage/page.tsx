"use client";

/**
 * Quota & Usage (spec §22 + §23).
 *
 * Per-provider usage, latency, fallback rate and configured quotas. Optional
 * metrics (tokens, audio duration) render only when the backend supplies them.
 * This is informational — no mechanism to bypass provider limits exists here.
 */

import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, StackedCounts, UpdatedAt, UtilizationBar } from "@/components/phase4/phase4-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { usageApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AIUsagePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const usage = useApi(
    () => usageApi.get({ date_from: from || undefined, date_to: to || undefined }),
    [from, to],
  );

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:usage")) usage.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = usage.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Quota & Usage"
        description="Provider usage, latency, fallbacks and configured quota utilization. Informational only."
        actions={<UpdatedAt at={null} />}
      />

      <SectionCard title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="usage-from">From (YYYY-MM-DD)</Label>
            <Input id="usage-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-09-01" className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usage-to">To (YYYY-MM-DD)</Label>
            <Input id="usage-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-09-23" className="w-44" />
          </div>
        </div>
      </SectionCard>

      {usage.error ? (
        <ErrorState message={usage.error} onRetry={usage.refresh} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {data.fallback_rate !== null && data.fallback_rate !== undefined ? (
            <SectionCard title="Fallback visibility" description="Share of requests served by fallbacks (spec §56).">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Fallback usage</p>
                  <p className="text-xl font-semibold tabular-nums">{formatPercent(data.fallback_rate)}</p>
                </div>
                <div className="min-w-48 flex-1">
                  <p className="mb-1 text-xs text-muted-foreground">Latency</p>
                  <LatencyStat stats={data.latency} className="text-sm" />
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Usage by provider" description="Optional metrics render only when reported.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Audio</TableHead>
                    <TableHead className="text-right">Fallbacks</TableHead>
                    <TableHead>Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={`${r.provider_id}-${r.model_id ?? "all"}`}>
                      <TableCell className="font-medium">{r.provider_name ?? r.provider_id}</TableCell>
                      <TableCell className="text-xs">{r.service_type}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(r.requests)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(r.success)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(r.errors)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.tokens !== null ? formatCount(r.tokens) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.audio_seconds !== null ? `${Math.round(r.audio_seconds / 60)} min` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(r.fallback_count)}</TableCell>
                      <TableCell><LatencyStat stats={r.latency} /></TableCell>
                    </TableRow>
                  ))}
                  {data.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                        No usage recorded for this window.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Quota utilization" description="Configured limits from the backend. Resets come from the provider.">
            {data.rows.filter((r) => r.quota).length === 0 ? (
              <p className="text-xs text-muted-foreground">No quotas configured.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.rows
                  .filter((r) => r.quota)
                  .map((r) => (
                    <UtilizationBar
                      key={r.provider_id}
                      label={`${r.provider_name ?? r.provider_id}${r.quota?.unit ? ` (${r.quota.unit})` : ""}`}
                      used={r.quota?.used ?? null}
                      limit={r.quota?.limit ?? null}
                      hint={
                        r.quota?.reset_at
                          ? `Resets ${new Date(r.quota.reset_at).toLocaleString("en-GB")} · ${formatCount(r.quota.remaining)} remaining`
                          : undefined
                      }
                    />
                  ))}
              </div>
            )}
          </SectionCard>

          {data.requests_by_provider ? (
            <SectionCard title="Requests by provider">
              <StackedCounts
                entries={data.requests_by_provider.map((r) => ({ label: r.label, value: r.value, tone: "info" as const }))}
              />
            </SectionCard>
          ) : null}

          {data.usage_over_time ? (
            <SectionCard title="Usage over time" description="Requests in the window, oldest first.">
              <TrendBars points={data.usage_over_time} />
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}

function TrendBars({ points }: { points: { at: string; value: number | null }[] }) {
  const max = Math.max(...points.map((p) => p.value ?? 0), 1);
  return (
    <div>
      <div className="flex h-20 items-end gap-0.5" role="img" aria-label="Usage over time">
        {points.map((p) => (
          <div
            key={p.at}
            title={`${new Date(p.at).toLocaleString("en-GB")}: ${p.value ?? 0}`}
            className="flex-1 rounded-t-sm bg-sky-500/70"
            style={{ height: `${Math.max(2, ((p.value ?? 0) / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Newest on the right · peak {formatCount(max)} requests
      </p>
    </div>
  );
}
