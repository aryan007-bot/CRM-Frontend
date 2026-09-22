"use client";

/**
 * Call Analysis (spec §17) — AI-generated structured analysis for completed
 * calls. The list shows classification summaries; the detail page exposes
 * rationale, evidence and audit fields — never hidden reasoning.
 */

import { useState } from "react";
import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { FilterBar, SearchInput } from "@/components/ops";
import {
  CallbackStatusBadge,
  DisputeStatusBadge,
  OutcomeBadge,
  PtpStatusBadge,
} from "@/components/recovery-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";

const OUTCOMES = [
  "PAID",
  "PROMISE_TO_PAY",
  "PAYMENT_INTENT",
  "CALLBACK",
  "ALREADY_PAID",
  "DISPUTE",
  "WRONG_NUMBER",
  "REFUSED",
  "HARDSHIP",
  "NO_ANSWER",
  "BUSY",
  "FAILED",
  "ESCALATED",
];

export default function CallAnalysisPage() {
  const [outcome, setOutcome] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const analyses = useApi(
    () =>
      api.listCallAnalyses({
        outcome: outcome === "all" ? undefined : outcome,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [outcome, debounced, page],
  );

  useRealtimeRefresh({ calls: analyses.refresh });

  const data = analyses.data ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Call Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Structured post-call analysis produced by the AI pipeline: outcomes, intent,
          confidence and evidence references.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} analyses` : "Loading…"}
              </span>
            }
          >
            <Select value={outcome} onValueChange={(v) => { setOutcome(v); setPage(1); }}>
              <SelectTrigger className="w-44" aria-label="Filter by outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search customer…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>PTP</TableHead>
                  <TableHead>Callback</TableHead>
                  <TableHead>Dispute</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.loading && !data ? (
                  <TableSkeleton rows={8} columns={12} />
                ) : analyses.error ? (
                  <TableRow>
                    <TableCell colSpan={12}>
                      <div className="p-4">
                        <ErrorState message={analyses.error} onRetry={analyses.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={12}
                    icon={BrainCircuit}
                    title="No analyses yet"
                    description="Completed AI calls are analysed automatically and appear here."
                  />
                ) : (
                  data?.items.map((analysis) => (
                    <TableRow key={analysis.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <Link href={`/call-analysis/${analysis.id}`} className="hover:underline">
                          {formatDateTime(analysis.call_time)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/call-analysis/${analysis.id}`} className="text-sm font-medium hover:underline">
                          {analysis.customer_name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs">
                        {analysis.campaign_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(analysis.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-xs uppercase">{analysis.language ?? "—"}</TableCell>
                      <TableCell><OutcomeBadge value={analysis.outcome} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="max-w-36 truncate">
                          {analysis.payment_intent?.replaceAll("_", " ") ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell><PtpStatusBadge value={analysis.ptp_status} /></TableCell>
                      <TableCell><CallbackStatusBadge value={analysis.callback_status} /></TableCell>
                      <TableCell>
                        {analysis.dispute_flag ? (
                          <DisputeStatusBadge value="OPEN" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {analysis.confidence ? `${Math.round(Number(analysis.confidence) * 100)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            analysis.status.toUpperCase() === "COMPLETED"
                              ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-secondary text-muted-foreground"
                          }
                        >
                          {analysis.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={analyses.loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
