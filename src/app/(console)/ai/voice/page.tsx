"use client";

/**
 * Voice Service Management (spec §24).
 *
 * Phase 4 adds infrastructure visibility (health, workers, usage, latency,
 * failures) over voice services. Voice profile *configuration* stays in
 * Phase 2 — this page links into it instead of rebuilding it.
 */

import Link from "next/link";
import { AudioLines } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { LatencyStat, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";
import { HealthBadge, ScopeBadge } from "@/components/phase4/phase4-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { voiceApi, workersApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { formatCount, formatRelative } from "@/lib/format";

export default function VoiceServicesPage() {
  const voice = useApi(() => voiceApi.infra(), []);
  const workers = useApi(() => workersApi.list(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).some((t) => ["phase4:telephony", "phase4:workers"].includes(t))) {
      voice.refresh();
      workers.refresh();
    }
  };
  useLiveCallSocket({ onEvent });

  const data = voice.data;
  const voiceWorkers = (workers.data ?? []).filter((w) => w.worker_type === "tts" || w.worker_type === "stt");

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Voice Services"
        description="TTS service health, workers, usage and failures. Voice profile configuration lives with AI Agents."
        actions={
          <>
            <UpdatedAt at={data?.updated_at} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/ai-agents">Open AI Agents (voice profiles)</Link>
            </Button>
          </>
        }
      />

      {voice.error ? (
        <ErrorState message={voice.error} onRetry={voice.refresh} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <SectionCard title="TTS services" description="Backend-reported synthesis service health.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.tts_services.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <HealthBadge value={s.state} />
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    <p>Latency: <LatencyStat stats={s.latency} /></p>
                    <p>{formatCount(s.usage_count)} synthesis requests · {formatCount(s.failures)} failures</p>
                    <p className="flex items-center gap-1.5">
                      <ScopeBadge scope={s.scope} />
                      {s.worker_count !== null ? `${formatCount(s.worker_count)} worker(s)` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {data.tts_services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voice services reported.</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Voice workers"
            description="STT/TTS workers serving the voice pipeline."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/infrastructure/workers">All workers</Link>
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead>Last heartbeat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voiceWorkers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/infrastructure/workers/${w.id}`} className="font-medium underline-offset-4 hover:underline">
                        {w.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{w.worker_type}</TableCell>
                    <TableCell className="text-xs">{w.status.toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(w.active_jobs)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelative(w.last_heartbeat_at)}</TableCell>
                  </TableRow>
                ))}
                {voiceWorkers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No voice workers registered.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </SectionCard>
        </>
      )}
    </div>
  );
}
