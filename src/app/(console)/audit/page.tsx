"use client";

/**
 * Infrastructure Audit view (spec §35).
 *
 * Reuses the audit infrastructure with Phase 4 filters (actor, action,
 * resource, result). It does not duplicate the existing audit system — this is
 * a filtered operational view over the same feed.
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
import { auditApi } from "@/lib/phase4-api";
import { formatDateTime } from "@/lib/format";

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const audit = useApi(
    () =>
      auditApi.list({
        search: debounced || undefined,
        result: result === "all" ? undefined : result,
        page,
        page_size: pageSize,
      }),
    [result, debounced, page],
  );

  const data = audit.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Audit Log"
        description="Operational audit trail: infrastructure and control-plane actions."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar>
            <Select value={result} onValueChange={(v) => { setResult(v); setPage(1); }}>
              <SelectTrigger className="w-36" aria-label="Filter by result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search actor, action or resource…"
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
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.loading && !data ? (
                  <TableSkeleton rows={8} columns={6} />
                ) : audit.error ? (
                  <TableMessage
                    columns={6}
                    icon={ScrollText}
                    title="Audit data is unavailable"
                    description={audit.error}
                  />
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={6}
                    icon={ScrollText}
                    title="No audit entries match the filters."
                  />
                ) : (
                  data?.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(a.at)}
                      </TableCell>
                      <TableCell className="text-xs">{a.actor ?? "system"}</TableCell>
                      <TableCell className="font-mono text-xs">{a.action}</TableCell>
                      <TableCell className="font-mono text-[11px]">{a.resource ?? "—"}</TableCell>
                      <TableCell>
                        <span className={a.result === "denied" ? "text-xs font-medium text-destructive" : "text-xs"}>
                          {a.result ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.detail ?? "—"}</TableCell>
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
            disabled={audit.loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
