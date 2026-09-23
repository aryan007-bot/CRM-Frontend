"use client";

/**
 * Security Events (spec §34).
 *
 * Timestamped security-relevant actions: actor, action, resource, result and
 * IP/device metadata where the backend provides it. Read-only for `security.read`.
 */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { SecuritySeverityBadge } from "@/components/phase4/phase4-badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar, SearchInput } from "@/components/ops";
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
import { securityApi } from "@/lib/phase4-api";
import { formatDateTime } from "@/lib/format";

const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function SecurityEventsPage() {
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const events = useApi(
    () =>
      securityApi.listEvents({
        severity: severity === "all" ? undefined : severity,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [severity, debounced, page],
  );

  const data = events.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Security Events"
        description="Security-relevant activity: authentication, permissions, configuration and control actions."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar>
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
              placeholder="Search actor or action…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.loading && !data ? (
                  <TableSkeleton rows={8} columns={8} />
                ) : events.error ? (
                  <TableMessage
                    columns={8}
                    icon={ShieldCheck}
                    title="Security events are unavailable"
                    description={events.error}
                  />
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={8}
                    icon={ShieldCheck}
                    title="No security events match the filters."
                  />
                ) : (
                  data?.items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(e.at)}
                      </TableCell>
                      <TableCell className="text-xs">{e.actor ?? "unknown"}</TableCell>
                      <TableCell className="font-mono text-xs">{e.action}</TableCell>
                      <TableCell className="font-mono text-[11px]">{e.resource ?? "—"}</TableCell>
                      <TableCell>
                        <span
                          className={
                            e.result === "denied" || e.result === "failure"
                              ? "text-xs font-medium text-destructive"
                              : "text-xs"
                          }
                        >
                          {e.result ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{e.ip ?? "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{e.user_agent ?? "—"}</TableCell>
                      <TableCell><SecuritySeverityBadge value={e.severity} /></TableCell>
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
            disabled={events.loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
