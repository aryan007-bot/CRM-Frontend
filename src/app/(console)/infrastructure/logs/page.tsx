"use client";

/**
 * Log viewer (spec §50).
 *
 * A safe, structured view over backend logs: timestamp, level, service,
 * correlation ids and message. Not a log aggregation platform — pagination is
 * server-side, and sensitive raw logs never reach the client.
 */

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
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
import { logsApi } from "@/lib/phase4-api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const LEVELS = ["INFO", "WARN", "ERROR"];
const SERVICES = ["api", "worker", "ai-gateway", "telephony", "database"];

export default function LogsPage() {
  const [level, setLevel] = useState("all");
  const [service, setService] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const logs = useApi(
    () =>
      logsApi.list({
        level: level === "all" ? undefined : level,
        service: service === "all" ? undefined : service,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [level, service, debounced, page],
  );

  const data = logs.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Logs"
        description="Structured application logs. Correlate entries by request or job id."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar>
            <Select value={service} onValueChange={(v) => { setService(v); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Filter by service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {SERVICES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1); }}>
              <SelectTrigger className="w-32" aria-label="Filter by level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search messages or ids…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead className="w-32">Service</TableHead>
                  <TableHead className="w-32">Request</TableHead>
                  <TableHead className="w-32">Job</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.loading && !data ? (
                  <TableSkeleton rows={10} columns={6} />
                ) : logs.error ? (
                  <TableMessage
                    columns={6}
                    icon={ScrollText}
                    title="Logs are unavailable"
                    description={logs.error}
                  />
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={6}
                    icon={ScrollText}
                    title="No log entries match the filters."
                  />
                ) : (
                  data?.items.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(l.at)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            l.level === "ERROR" && "text-destructive",
                            l.level === "WARN" && "text-amber-700 dark:text-amber-400",
                            l.level === "INFO" && "text-muted-foreground",
                          )}
                        >
                          {l.level}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{l.service ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[11px]">{l.request_id ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[11px]">{l.job_id ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.message ?? "—"}</TableCell>
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
            disabled={logs.loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
