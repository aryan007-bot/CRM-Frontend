"use client";

/**
 * Campaign Overview tab (spec §8) — progress, outcome distributions and
 * recent activity. All values come from the backend; nothing is invented.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { can, type Capability } from "@/lib/capabilities";
import { AddLeadsDialog } from "./add-leads-dialog";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { DistributionBar, MetricRow, VerificationCallout } from "@/components/ops";
import type { DistEntry } from "@/components/ops";
import { PtpStatusBadge, QueueStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function CampaignOverviewPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const distribution = useApi(
    campaignId ? () => api.getCampaignDistribution(campaignId) : null,
    [campaignId],
  );
  const activity = useApi(
    campaignId ? () => api.getCampaignActivity(campaignId, 1, 10) : null,
    [campaignId],
  );

  const outcomeTone = (outcome: string): DistEntry["tone"] => {
    const normalized = outcome.toUpperCase();
    if (["PAID", "ALREADY_PAID"].includes(normalized)) return "success";
    if (["PROMISE_TO_PAY", "PAYMENT_INTENT"].includes(normalized)) return "info";
    if (["CALLBACK"].includes(normalized)) return "progress";
    if (["DISPUTE", "ESCALATED", "FAILED"].includes(normalized)) return "danger";
    if (["REFUSED", "HARDSHIP", "WRONG_NUMBER", "WRONG_PERSON", "BUSY"].includes(normalized)) return "warning";
    return "neutral";
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recovery outcome distribution</CardTitle>
            <CardDescription>Conversational outcomes across all attempted leads.</CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.loading && !distribution.data ? (
              <Table>
                <TableBody>
                  <TableSkeleton rows={3} columns={1} />
                </TableBody>
              </Table>
            ) : distribution.error ? (
              <ErrorState message={distribution.error} onRetry={distribution.refresh} compact />
            ) : (
              <DistributionBar
                entries={(distribution.data?.recovery_outcomes ?? []).map((o) => ({
                  label: o.outcome.replaceAll("_", " "),
                  value: o.count,
                  tone: outcomeTone(o.outcome),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call outcome distribution</CardTitle>
            <CardDescription>Telephony-level results of every attempt.</CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.loading && !distribution.data ? (
              <Table>
                <TableBody>
                  <TableSkeleton rows={3} columns={1} />
                </TableBody>
              </Table>
            ) : distribution.error ? (
              <div className="h-10" />
            ) : (
              <DistributionBar
                entries={(distribution.data?.call_outcomes ?? []).map((o) => ({
                  label: o.outcome.replaceAll("_", " "),
                  value: o.count,
                  tone: outcomeTone(o.outcome),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment intent signals</CardTitle>
            <CardDescription>
              What customers said — verification state is tracked separately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.loading && !distribution.data ? (
              <Table>
                <TableBody>
                  <TableSkeleton rows={3} columns={1} />
                </TableBody>
              </Table>
            ) : distribution.error ? (
              <div className="h-10" />
            ) : (
              <DistributionBar
                entries={(distribution.data?.payment_intents ?? []).map((i) => ({
                  label: i.intent.replaceAll("_", " "),
                  value: i.count,
                  tone:
                    i.intent === "FULL_PAYMENT" || i.intent === "ALREADY_PAID"
                      ? "success"
                      : i.intent === "PROMISE_TO_PAY"
                        ? "info"
                        : "neutral",
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Campaign funnel at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressSummary campaignId={campaignId} />
            <AddAccountsRow campaignId={campaignId} />
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" aria-hidden />
            Recent activity
          </CardTitle>
          <CardDescription>
            Automated and operator actions on this campaign. Full history in the Activity tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {activity.loading && !activity.data ? (
            <Table>
              <TableBody>
                <TableSkeleton rows={4} columns={3} />
              </TableBody>
            </Table>
          ) : activity.error ? (
            <div className="p-4">
              <ErrorState message={activity.error} onRetry={activity.refresh} compact />
            </div>
          ) : activity.data && activity.data.items.length === 0 ? (
            <Table>
              <TableBody>
                <TableMessage
                  columns={3}
                  icon={Activity}
                  title="No activity yet"
                  description="Campaign events appear here once it starts processing leads."
                />
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.action}</TableCell>
                    <TableCell className="max-w-96 truncate text-xs text-muted-foreground">
                      {item.detail ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{item.actor ?? "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Quick path to attach accounts (Phase 1 flow, also used by the E2E suite). */
function AddAccountsRow({ campaignId }: { campaignId?: string }) {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);
  const [open, setOpen] = useState(false);

  if (!allowed("campaign.update")) return null;

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add accounts
      </Button>
      {campaignId ? (
        <AddLeadsDialog
          campaignId={campaignId}
          open={open}
          onOpenChange={setOpen}
          onAdded={() => {
            /* metrics refresh via realtime bridge or manual reload */
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressSummary({ campaignId }: { campaignId?: string }) {
  const metrics = useApi(campaignId ? () => api.getCampaignMetrics(campaignId) : null, [campaignId]);
  const m = metrics.data;

  if (metrics.error) {
    return <ErrorState message={metrics.error} onRetry={metrics.refresh} compact />;
  }

  return (
    <div className="space-y-3">
      <MetricRow
        columns="grid-cols-2 sm:grid-cols-3"
        metrics={[
          { label: "Leads processed", value: (m?.total_leads ?? 0) - (m?.pending ?? 0) },
          { label: "Calls attempted", value: m?.attempted ?? "—" },
          { label: "Connected", value: m?.connected ?? "—" },
          { label: "Successful outcomes", value: (m?.promised ?? 0) + (m?.paid ?? 0) },
          { label: "Pending follow-ups", value: m?.follow_ups_pending ?? "—" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">PTP summary</p>
          <div className="flex items-center gap-2">
            <PtpStatusBadge value="PENDING" />
            <PtpStatusBadge value="DUE" />
            <PtpStatusBadge value="PAID" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Open promises are managed in <Link className="underline" href="/recovery/ptp">Promise to Pay</Link>.
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Escalation summary</p>
          <div className="flex items-center gap-2">
            <QueueStatusBadge value="ESCALATED" />
            <span className="text-sm font-semibold tabular-nums">{m?.escalations ?? "—"}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Human review queue: <Link className="underline" href="/recovery/escalations">Escalations</Link>.
          </p>
        </div>
      </div>
      <VerificationCallout
        signal="conversational outcomes only"
        verified={false}
      />
    </div>
  );
}
