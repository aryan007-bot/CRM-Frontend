"use client";

/**
 * Call analysis detail (spec §17) — structured classifications, short
 * backend-provided rationale, confidence, extracted entities and transcript
 * evidence references. Hidden chain-of-thought is never exposed because the
 * backend never sends it; the UI only renders these explicit fields.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BrainCircuit } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/page-states";
import { DetailField, VerificationCallout } from "@/components/ops";
import {
  CallbackStatusBadge,
  DisputeStatusBadge,
  EscalationStatusBadge,
  OutcomeBadge,
  PaymentIntentBadge,
  PtpStatusBadge,
} from "@/components/recovery-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";

function offsetLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CallAnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params?.id;

  const analysis = useApi(
    analysisId ? () => api.getCallAnalysis(analysisId) : null,
    [analysisId],
  );

  const data = analysis.data;

  if (analysis.loading && !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={analysis.error ?? "Analysis not found."} onRetry={analysis.refresh} />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/call-analysis">Back to call analysis</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={data.customer_name ?? "Call analysis"}
        description={`${formatDateTime(data.call_time)} · ${formatDuration(data.duration_seconds)} · ${data.campaign_name ?? "no campaign"}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/call-analysis">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/live-calls/${data.call_id}`}>Open call</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Backend-generated structured summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{data.summary ?? "No summary available."}</p>
            <div className="flex flex-wrap gap-1.5">
              <OutcomeBadge value={data.outcome} />
              <PaymentIntentBadge value={data.payment_intent} />
              <PtpStatusBadge value={data.ptp_status} />
              <CallbackStatusBadge value={data.callback_status} />
              {data.dispute_flag ? <DisputeStatusBadge value="OPEN" /> : null}
              {data.escalated ? <EscalationStatusBadge value="OPEN" /> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Confidence:{" "}
              <span className="font-medium text-foreground">
                {data.confidence ? `${Math.round(Number(data.confidence) * 100)}%` : "—"}
              </span>{" "}
              · Language: {data.language?.toUpperCase() ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversation outcome</CardTitle>
            <CardDescription>Classification and the model&apos;s short rationale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Recovery outcome" value={<OutcomeBadge value={data.recovery_outcome ?? data.outcome} />} />
              <DetailField label="Intent" value={data.intent?.replaceAll("_", " ") ?? "—"} />
            </div>
            {data.rationale ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                <p className="font-medium">Rationale</p>
                <p className="mt-1 text-muted-foreground">{data.rationale}</p>
              </div>
            ) : null}
            {data.intent_rationale ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                <p className="font-medium">Intent rationale</p>
                <p className="mt-1 text-muted-foreground">{data.intent_rationale}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment &amp; PTP</CardTitle>
            <CardDescription>Conversational signals vs verified state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Amount mentioned" value={data.amount_mentioned ? formatMoney(data.amount_mentioned) : "—"} />
              <DetailField label="Promised amount" value={data.promised_amount ? formatMoney(data.promised_amount) : "—"} />
              <DetailField label="Promised date" value={data.promised_date ?? "—"} />
              <DetailField label="Callback at" value={data.callback_at ? formatDateTime(data.callback_at) : "—"} />
            </div>
            <VerificationCallout
              signal={data.payment_intent?.replaceAll("_", " ").toLowerCase() ?? "no intent"}
              verified={data.payment_intent ? false : undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispute &amp; escalation</CardTitle>
            <CardDescription>AI flags pending human confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailField label="Dispute type" value={data.dispute_type?.replaceAll("_", " ") ?? "—"} />
            {data.dispute_note ? (
              <p className="text-xs text-muted-foreground">{data.dispute_note}</p>
            ) : null}
            <Separator />
            <DetailField label="Escalation reason" value={data.escalation_reason?.replaceAll("_", " ") ?? "—"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Key events</CardTitle>
            <CardDescription>Timestamped moments extracted from the conversation.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.key_events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No key events recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.key_events.map((event, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {offsetLabel(event.at_offset_seconds)}
                    </Badge>
                    <span>
                      <span className="font-medium">{event.label}</span>
                      {event.detail ? (
                        <span className="block text-xs text-muted-foreground">{event.detail}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>
              Transcript excerpts supporting each classification, with offsets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript evidence attached.</p>
            ) : (
              <ul className="space-y-2">
                {data.evidence.map((item, index) => (
                  <li key={index} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {offsetLabel(item.transcript_offset_seconds)}
                      </Badge>
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    {item.snippet ? (
                      <blockquote className="mt-1 border-l-2 pl-3 text-xs text-muted-foreground italic">
                        “{item.snippet}”
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Full transcript available on the{" "}
              <Link className="underline" href={`/live-calls/${data.call_id}`}>
                call detail page
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="size-4" aria-hidden />
              AI metadata &amp; audit trail
            </CardTitle>
            <CardDescription>
              Provenance of this analysis. This page never exposes model reasoning beyond
              the fields the backend explicitly returns.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <DetailField label="Model" value={data.model ?? "—"} />
            <DetailField label="Model version" value={data.model_version ?? "—"} />
            <DetailField label="Generated" value={formatDateTime(data.created_at)} />
            <DetailField label="Analysis ID" value={data.id} mono />
            <DetailField label="Call ID" value={data.call_id} mono />
            <DetailField label="Status" value={data.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
