"use client";

/**
 * Campaign Analytics tab (spec §22) — operational metrics from
 * /campaigns/{id}/analytics. Conversational outcomes and verified payments
 * are always reported separately; money is formatted with exact decimals.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { ErrorState, PageSkeleton } from "@/components/page-states";
import { DistributionBar, MetricRow } from "@/components/ops";
import type { DistEntry } from "@/components/ops";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDuration, formatMoney } from "@/lib/format";
import type { RecoveryAnalyticsResponse } from "@/lib/types";

function outcomeTone(outcome: string): DistEntry["tone"] {
  const normalized = outcome.toUpperCase();
  if (["PAID", "ALREADY_PAID"].includes(normalized)) return "success";
  if (["PROMISE_TO_PAY", "PAYMENT_INTENT"].includes(normalized)) return "info";
  if (normalized === "CALLBACK") return "progress";
  if (["DISPUTE", "ESCALATED", "FAILED"].includes(normalized)) return "danger";
  return "warning";
}

function rate(numerator: number | undefined, denominator: number | undefined): string {
  if (!numerator || !denominator || denominator === 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const analytics = useApi(
    campaignId
      ? () =>
          api.getCampaignAnalytics(campaignId, {
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          })
      : null,
    [campaignId, dateFrom, dateTo],
  );

  const data: RecoveryAnalyticsResponse | null = analytics.data ?? null;
  const s = data?.summary;

  if (analytics.loading && !data) {
    return (
      <div className="space-y-4">
        <PageSkeleton />
      </div>
    );
  }

  if (analytics.error) {
    return <ErrorState message={analytics.error} onRetry={analytics.refresh} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="an-from" className="text-xs text-muted-foreground">From</label>
          <input
            id="an-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          />
          <label htmlFor="an-to" className="text-xs text-muted-foreground">to</label>
          <input
            id="an-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>

      <MetricRow
        columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        metrics={[
          { label: "Leads processed", value: s?.leads_processed ?? "—" },
          { label: "Calls attempted", value: s?.calls_attempted ?? "—" },
          { label: "Calls connected", value: s?.calls_connected ?? "—" },
          { label: "Connection rate", value: rate(s?.calls_connected, s?.calls_attempted) },
          { label: "Conversations", value: s?.conversations_completed ?? "—" },
          { label: "No-answer rate", value: rate(s?.no_answer, s?.calls_attempted) },
          { label: "Busy rate", value: rate(s?.busy, s?.calls_attempted) },
          { label: "Failed-call rate", value: rate(s?.failed, s?.calls_attempted) },
          { label: "Avg call duration", value: formatDuration(
              s && s.calls_connected > 0
                ? Math.round(s.total_call_seconds / s.calls_connected)
                : undefined,
            ) },
          { label: "Avg attempts / lead", value:
              s && s.leads_processed > 0
                ? (Math.round((s.total_attempts / s.leads_processed) * 10) / 10).toFixed(1)
                : "—" },
          { label: "PTP count", value: s?.ptp_count ?? "—" },
          { label: "PTP amount", value: formatMoney(s?.ptp_amount ?? null) },
          { label: "Payment intent", value: s?.payment_intent_count ?? "—" },
          {
            label: "Payment confirmed",
            value: s?.payment_confirmed_count ?? "—",
            hint: "Verified payments only — not conversational claims",
          },
          { label: "Disputes", value: s?.dispute_count ?? "—" },
          { label: "Callbacks", value: s?.callback_count ?? "—" },
          { label: "Escalations", value: s?.escalation_count ?? "—" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recovery outcomes</CardTitle>
            <CardDescription>Conversational outcome mix for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              entries={(data?.outcomes ?? []).map((o) => ({
                label: o.outcome.replaceAll("_", " "),
                value: o.count,
                tone: outcomeTone(o.outcome),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment intent signals</CardTitle>
            <CardDescription>
              Conversational intent — verification is tracked separately per account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionBar
              entries={(data?.payment_intents ?? []).map((i) => ({
                label: i.intent.replaceAll("_", " "),
                value: i.count,
                tone: i.intent === "FULL_PAYMENT" ? "success" : i.intent === "PROMISE_TO_PAY" ? "info" : "neutral",
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Connection trend</CardTitle>
          <CardDescription>Daily attempted vs connected calls and PTP count.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <TrendTable points={data?.trends ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

function TrendTable({ points }: { points: RecoveryAnalyticsResponse["trends"] }) {
  if (points.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No trend data for the selected period yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 text-right font-medium">Attempted</th>
            <th className="px-4 py-2 text-right font-medium">Connected</th>
            <th className="px-4 py-2 text-right font-medium">PTP</th>
            <th className="px-4 py-2 text-right font-medium">Paid</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date} className="border-t">
              <td className="px-4 py-2">{point.date}</td>
              <td className="px-4 py-2 text-right tabular-nums">{point.calls_attempted}</td>
              <td className="px-4 py-2 text-right tabular-nums">{point.calls_connected}</td>
              <td className="px-4 py-2 text-right tabular-nums">{point.ptp_count}</td>
              <td className="px-4 py-2 text-right tabular-nums">{point.paid_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
