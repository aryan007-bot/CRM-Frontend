"use client";

/**
 * Recovery Analytics (spec §23) — portfolio-wide operational analytics.
 * Every number maps to the backend's /analytics/recovery fields; no vanity
 * metrics. Conversational outcomes and verified payments stay separated.
 */

import { useState } from "react";
import Link from "next/link";
import { Download, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, PageSkeleton } from "@/components/page-states";
import { DistributionBar, MetricRow } from "@/components/ops";
import type { DistEntry } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatDuration, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { RecoveryAnalyticsResponse } from "@/lib/types";

function outcomeTone(outcome: string): DistEntry["tone"] {
  const normalized = outcome.toUpperCase();
  if (["PAID", "ALREADY_PAID"].includes(normalized)) return "success";
  if (["PROMISE_TO_PAY", "PAYMENT_INTENT"].includes(normalized)) return "info";
  if (normalized === "CALLBACK") return "progress";
  if (["DISPUTE", "ESCALATED", "FAILED"].includes(normalized)) return "danger";
  return "warning";
}

function rate(num: number | undefined, den: number | undefined): string {
  if (!num || !den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

export default function RecoveryAnalyticsPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [creditorId, setCreditorId] = useState("all");
  const [outcome, setOutcome] = useState("all");

  const campaigns = useApi(() => api.listCampaigns({ page_size: 100 }), []);
  const creditors = useApi(() => api.listCreditors({ page_size: 100 }), []);

  const analytics = useApi(
    () =>
      api.getRecoveryAnalytics({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        campaign_id: campaignId === "all" ? undefined : campaignId,
        creditor_id: creditorId === "all" ? undefined : creditorId,
        outcome: outcome === "all" ? undefined : outcome,
      }),
    [dateFrom, dateTo, campaignId, creditorId, outcome],
  );

  const data: RecoveryAnalyticsResponse | null = analytics.data ?? null;
  const s = data?.summary;

  async function exportReport() {
    try {
      await api.createExport({
        export_type: "recovery_analytics",
        file_format: "xlsx",
        campaign_id: campaignId === "all" ? null : campaignId,
        filters: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          outcome: outcome === "all" ? undefined : outcome,
        },
      });
      toast.success("Report export started. Collect it from the campaign's Exports tab.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start the export.");
    }
  }

  if (analytics.loading && !data) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recovery Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Operational recovery performance across campaigns. Verified payments are reported
            separately from conversational outcomes.
          </p>
        </div>
        {allowed("export.create") ? (
          <Button variant="outline" onClick={() => void exportReport()}>
            <Download className="size-4" />
            Export filtered report
          </Button>
        ) : null}
      </header>

      {analytics.error ? (
        <ErrorState message={analytics.error} onRetry={analytics.refresh} />
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="grid gap-3 py-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <Label htmlFor="ra-from">From</Label>
                <Input id="ra-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ra-to">To</Label>
                <Input id="ra-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label>Campaign</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger aria-label="Campaign filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All campaigns</SelectItem>
                    {(campaigns.data?.items ?? []).map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Creditor</Label>
                <Select value={creditorId} onValueChange={setCreditorId}>
                  <SelectTrigger aria-label="Creditor filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All creditors</SelectItem>
                    {(creditors.data?.items ?? []).map((creditor) => (
                      <SelectItem key={creditor.id} value={creditor.id}>{creditor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger aria-label="Outcome filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    {["PAID", "PROMISE_TO_PAY", "CALLBACK", "DISPUTE", "REFUSED", "NO_ANSWER", "BUSY", "FAILED"].map((o) => (
                      <SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Operational overview */}
          <section>
            <h2 className="mb-2 text-sm font-semibold">Operational overview</h2>
            <MetricRow
              columns="grid-cols-2 sm:grid-cols-4 xl:grid-cols-6"
              metrics={[
                { label: "Leads processed", value: s?.leads_processed ?? "—" },
                { label: "Calls attempted", value: s?.calls_attempted ?? "—" },
                { label: "Calls connected", value: s?.calls_connected ?? "—" },
                { label: "Connection rate", value: rate(s?.calls_connected, s?.calls_attempted) },
                { label: "Conversations", value: s?.conversations_completed ?? "—" },
                { label: "Avg call duration", value: formatDuration(
                    s && s.calls_connected > 0 ? Math.round(s.total_call_seconds / s.calls_connected) : undefined,
                  ) },
                { label: "No-answer rate", value: rate(s?.no_answer, s?.calls_attempted) },
                { label: "Busy rate", value: rate(s?.busy, s?.calls_attempted) },
                { label: "Failed-call rate", value: rate(s?.failed, s?.calls_attempted) },
                { label: "Avg attempts / lead", value: s && s.leads_processed > 0
                    ? (Math.round((s.total_attempts / s.leads_processed) * 10) / 10).toFixed(1)
                    : "—" },
              ]}
            />
          </section>

          {/* Recovery outcomes + payment sections */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recovery outcomes</CardTitle>
                <CardDescription>Conversational outcome mix.</CardDescription>
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
                <CardTitle>Payment intent</CardTitle>
                <CardDescription>Signals from conversations — verification pending.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DistributionBar
                  entries={(data?.payment_intents ?? []).map((i) => ({
                    label: i.intent.replaceAll("_", " "),
                    value: i.count,
                    tone: i.intent === "FULL_PAYMENT" ? "success" : i.intent === "PROMISE_TO_PAY" ? "info" : "neutral",
                  }))}
                />
                <MetricRow
                  columns="grid-cols-2"
                  metrics={[
                    { label: "PTP count", value: s?.ptp_count ?? "—" },
                    { label: "PTP amount promised", value: formatMoney(s?.ptp_amount ?? null) },
                    {
                      label: "Payments confirmed",
                      value: s?.payment_confirmed_count ?? "—",
                      hint: "Backend-verified only",
                    },
                    { label: "Verified amount", value: formatMoney(s?.ptp_amount_confirmed ?? null) },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PTP · Disputes · Callbacks · Escalations</CardTitle>
                <CardDescription>Workload indicators for the recovery back-office.</CardDescription>
              </CardHeader>
              <CardContent>
                <MetricRow
                  columns="grid-cols-2 sm:grid-cols-4"
                  metrics={[
                    { label: "PTP", value: s?.ptp_count ?? "—" },
                    { label: "Disputes", value: s?.dispute_count ?? "—" },
                    { label: "Callbacks", value: s?.callback_count ?? "—" },
                    { label: "Escalations", value: s?.escalation_count ?? "—" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4" aria-hidden />
                  Trend
                </CardTitle>
                <CardDescription>Daily calls and verified payments.</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendPreview points={data?.trends ?? []} />
              </CardContent>
            </Card>
          </div>

          {/* Campaign comparison */}
          <Card className="py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Campaign comparison</CardTitle>
              <CardDescription>Side-by-side performance for the filtered period.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Attempted</TableHead>
                      <TableHead className="text-right">Connected</TableHead>
                      <TableHead className="text-right">Conn. rate</TableHead>
                      <TableHead className="text-right">PTP</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Disputed</TableHead>
                      <TableHead className="text-right">Escalated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.campaigns ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                          No campaign data for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.campaigns.map((row) => (
                        <TableRow key={row.campaign_id}>
                          <TableCell>
                            <Link href={`/campaigns/${row.campaign_id}`} className="text-sm font-medium hover:underline">
                              {row.campaign_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.attempted}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.connected}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {rate(row.connected, row.attempted)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.ptp}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.paid}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.disputed}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.escalated}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TrendPreview({ points }: { points: RecoveryAnalyticsResponse["trends"] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No trend data for the selected period.</p>;
  }
  const max = Math.max(...points.map((p) => p.calls_attempted), 1);
  return (
    <div className="space-y-1.5" role="img" aria-label="Daily attempted calls trend">
      {points.slice(-14).map((point) => (
        <div key={point.date} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-muted-foreground">{point.date.slice(5)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${Math.round((point.calls_attempted / max) * 100)}%` }}
              title={`${point.date}: ${point.calls_attempted} attempted, ${point.calls_connected} connected, ${point.paid_count} paid`}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">{point.calls_attempted}</span>
        </div>
      ))}
    </div>
  );
}
