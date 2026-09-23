"use client";

/**
 * Failed-job console (spec §11 + §49).
 *
 * Server-side paginated job list with URL-safe filters and a reusable job
 * inspector. Raw stack traces are not shown; the technical-details section is
 * backend-redacted and only rendered for authorized admins.
 */

import { useState } from "react";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { JobInspector } from "@/components/phase4/phase4-parts";
import { JobStatusBadge } from "@/components/phase4/phase4-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { jobsApi } from "@/lib/phase4-api";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";
import { JobDetail } from "@/lib/phase4-types";

const STATUSES = ["FAILED", "RETRYING", "DEAD", "CANCELLED", "RECOVERED"];
const QUEUES = ["dial_queue", "analysis_queue", "follow_up_queue", "export_queue", "voice_queue", "stt_queue", "tts_queue"];

export default function FailedJobsPage() {
  const { user } = useAuth();
  const canManage = can("queue.manage", user?.roles);
  const isAdmin = can("configuration.read", user?.roles);

  const [status, setStatus] = useState("all");
  const [queue, setQueue] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const jobs = useApi(
    () =>
      jobsApi.list({
        status: status === "all" ? undefined : status,
        queue: queue === "all" ? undefined : queue,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, queue, debounced, page],
  );

  const [openJob, setOpenJob] = useState<JobDetail | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);

  async function inspect(id: string) {
    setInspectBusy(true);
    try {
      const detail = await jobsApi.get(id);
      setOpenJob(detail);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the job.");
    } finally {
      setInspectBusy(false);
    }
  }

  async function act(id: string, action: "retry" | "cancel") {
    try {
      await jobsApi.action(id, action);
      toast.success(action === "retry" ? "Job re-enqueued." : "Job cancelled.");
      setOpenJob(null);
      jobs.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed.");
    }
  }

  const data = jobs.data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Failed Jobs"
        description="Operational console for failed, retrying and dead jobs across queues."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={queue} onValueChange={(v) => { setQueue(v); setPage(1); }}>
              <SelectTrigger className="w-44" aria-label="Filter by queue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All queues</SelectItem>
                {QUEUES.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search type or error code…"
            />
          </FilterBar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Retryable</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Related</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.loading && !data ? (
                  <TableSkeleton rows={8} columns={12} />
                ) : jobs.error ? (
                  <TableMessage
                    columns={12}
                    icon={ListOrdered}
                    title="Job data is unavailable"
                    description={jobs.error}
                  />
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={12}
                    icon={ListOrdered}
                    title="No jobs match the filters."
                    description="Failed, retrying and dead jobs appear here."
                  />
                ) : (
                  data?.items.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">{j.id}</TableCell>
                      <TableCell className="font-mono text-xs">{j.queue ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{j.job_type ?? "—"}</TableCell>
                      <TableCell><JobStatusBadge value={j.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{j.attempts ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(j.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatRelative(j.last_attempt_at)}</TableCell>
                      <TableCell className="text-xs">{j.error_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{j.retryable ? "yes" : "no"}</TableCell>
                      <TableCell className="text-xs">{j.worker_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {j.related?.href ? (
                          <Link href={j.related.href} className="underline-offset-4 hover:underline">
                            {j.related.label ?? j.related.kind}
                          </Link>
                        ) : (
                          j.related?.label ?? "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void inspect(j.id)}>
                          Inspect
                        </Button>
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
            disabled={jobs.loading}
          />
        </CardContent>
      </Card>

      <Dialog open={openJob !== null} onOpenChange={(open) => (open ? null : setOpenJob(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job inspector</DialogTitle>
            <DialogDescription className="font-mono text-xs">{openJob?.id}</DialogDescription>
          </DialogHeader>
          {openJob ? (
            <>
              <JobInspector job={openJob}>
                {canManage && !isAdmin ? null : null}
              </JobInspector>
              {canManage ? (
                <div className="flex justify-end gap-2 border-t pt-3">
                  {openJob.retryable ? (
                    <Button variant="outline" size="sm" onClick={() => void act(openJob.id, "retry")}>
                      Retry job
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => void act(openJob.id, "cancel")}
                  >
                    Cancel job
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
