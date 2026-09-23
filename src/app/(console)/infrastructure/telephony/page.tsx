"use client";

/**
 * Telephony Infrastructure (spec §14).
 *
 * Gateways, registrations, capacity and errors at the infrastructure level.
 * Phase 2 remains the source of truth for call lifecycle — this page never
 * controls calls. Capacities are backend-provided; nothing is hardcoded.
 */

import { PhoneOff, Radio } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { GatewayStateBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { CapacityMeter } from "@/components/phase4/phase4-parts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { infraApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatDateTime, formatRelative } from "@/lib/format";
import { formatPercent } from "@/lib/phase4-format";
import { formatCount } from "@/lib/format";

export default function TelephonyInfrastructurePage() {
  const telephony = useApi(() => infraApi.telephony(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:telephony")) telephony.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = telephony.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Telephony"
        description="Trunk and gateway infrastructure: registrations, channel capacity and call errors. Call control lives in Live Calls."
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {telephony.error ? (
        <ErrorState message={telephony.error} onRetry={telephony.refresh} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Active channels" value={formatCount(data.active_channels)} />
            <SummaryTile label="Active calls" value={formatCount(data.active_calls)} />
            <SummaryTile
              label="GSM gateways online"
              value={`${formatCount(data.gsm_online)} / ${formatCount(data.gsm_total)}`}
            />
            <SummaryTile
              label="Failed call rate"
              value={data.failed_call_rate !== null ? formatPercent(data.failed_call_rate) : "—"}
            />
          </div>

          <SectionCard
            title="Call setup latency"
            description="Reported by the backend telephony probes."
          >
            <LatencyStat stats={data.setup_latency} className="text-sm" />
          </SectionCard>

          <SectionCard title="Gateways" description="Backend-reported registration and capacity.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead className="text-right">Active calls</TableHead>
                    <TableHead className="w-44">Capacity</TableHead>
                    <TableHead className="text-right">Failed calls</TableHead>
                    <TableHead>Last heartbeat</TableHead>
                    <TableHead>Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.gateways.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                        <Radio className="mx-auto mb-1 size-5 text-muted-foreground" aria-hidden />
                        No gateways registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.gateways.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-xs">{g.provider_type ?? "—"}</TableCell>
                        <TableCell><GatewayStateBadge value={g.state} /></TableCell>
                        <TableCell className="text-xs">{g.registration ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCount(g.active_calls)}</TableCell>
                        <TableCell>
                          <CapacityMeter label="" value={g.active_calls} max={g.capacity} unit="" />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCount(g.failed_calls)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(g.last_heartbeat_at)}</TableCell>
                        <TableCell><ScopeBadge scope={g.scope} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Telephony errors" description="Recent backend-recorded telephony errors.">
            {data.errors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No telephony errors recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.errors.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded-md border px-3 py-2">
                    <PhoneOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.code ?? "ERROR"}</p>
                      <p className="text-xs text-muted-foreground">{e.message ?? "No detail."}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(e.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <p className="text-xs text-muted-foreground">
            SIP registrations: {formatCount(data.sip_registrations)} · Values are reported by the telephony infrastructure and may lag by one heartbeat.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
