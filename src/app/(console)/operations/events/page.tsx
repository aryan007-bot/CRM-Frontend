"use client";

/**
 * Realtime Event Stream (spec §39).
 *
 * Server-persisted events with filters in the URL (spec §65). The existing
 * WebSocket appends matching realtime events live on top of the fetched page;
 * a bounded in-memory dedupe keeps duplicates out (spec §73).
 */

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";


import { Pagination } from "@/components/pagination";
import { EventStreamView, SectionCard } from "@/components/phase4/phase4-parts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar, SearchInput } from "@/components/ops";
import { useApi } from "@/hooks/use-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { eventsApi } from "@/lib/phase4-api";
import { appendStreamEvent, EventDeduper, targetsForEvent } from "@/lib/phase4-realtime";
import type { RealtimeEvent } from "@/lib/phase4-types";

const SEVERITIES = ["INFO", "WARNING", "ERROR", "CRITICAL"];

const EVENT_SERVICES = [
  "api",
  "database",
  "workers",
  "analysis",
  "dial_queue",
  "telephony",
  "deepgram",
  "deployment",
];

export default function EventStreamPage() {
  const [service, setService] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const events = useApi(
    () =>
      eventsApi.list({
        service: service === "all" ? undefined : service,
        severity: severity === "all" ? undefined : severity,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [service, severity, debounced, page],
  );

  const [live, setLive] = useState<RealtimeEvent[]>([]);
  const deduper = useMemo(() => new EventDeduper(), []);

  const onEvent = (event: { id?: string; event: string; timestamp: string; data?: unknown }) => {
    if (targetsForEvent(event.event).length === 0) return;
    const id = event.id ?? `${event.event}:${event.timestamp}`;
    if (deduper.seen(id)) return;
    setLive((rows) => appendStreamEvent(rows, event));
  };
  const { connectionState } = useLiveCallSocket({ onEvent });

  const combined = useMemo(() => {
    const persisted = events.data?.items ?? [];
    const persistedIds = new Set(persisted.map((e) => e.id));
    const dedupedLive = live.filter((r) => !persistedIds.has(r.id));
    return [...dedupedLive, ...persisted];
  }, [live, events.data]);


  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Event Stream"
        description="Live operational events across the platform. Filters are reflected in the URL."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              connectionState === "LIVE" ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
                  Live
                </span>
              ) : (
                <span className="text-xs text-amber-700 dark:text-amber-400">Realtime connection interrupted.</span>
              )
            }
          >
            <Select value={service} onValueChange={(v) => { setService(v); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Filter by service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {EVENT_SERVICES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
              <SelectTrigger className="w-36" aria-label="Filter by severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search messages…"
            />
          </FilterBar>

          <div className="p-4">
            {events.error ? (
              <ErrorState message={events.error} onRetry={events.refresh} />
            ) : events.loading && !events.data ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading events…</p>
            ) : (
              <EventStreamView
                events={combined}
                emptyLabel="No events match the current filters."
              />
            )}
          </div>

          <Pagination
            page={events.data?.page ?? page}
            pageSize={events.data?.page_size ?? pageSize}
            total={events.data?.total ?? 0}
            onPageChange={setPage}
            disabled={events.loading}
          />
        </CardContent>
      </Card>

      <SectionCard
        title="Realtime tail"
        description="Events arriving over the socket since you opened this page."
      >
        <EventStreamView events={live} emptyLabel="No realtime events yet." />
      </SectionCard>
    </div>
  );
}
