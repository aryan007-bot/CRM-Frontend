"use client";

/**
 * Callbacks (spec §14) — scheduled callback management with reschedule and
 * cancel actions. Date-time controls follow the organization's timezone rules
 * (the backend interprets timestamps against the campaign timezone).
 */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ConfirmActionDialog, FilterBar, SearchInput } from "@/components/ops";
import { CallbackStatusBadge, OutcomeBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Callback } from "@/lib/types";

const STATUSES = ["SCHEDULED", "DUE", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"];

export default function CallbacksPage() {
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [rescheduleTarget, setRescheduleTarget] = useState<Callback | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Callback | null>(null);
  const [acting, setActing] = useState(false);

  const callbacks = useApi(
    () =>
      api.listCallbacks({
        status: status === "all" ? undefined : status,
        search: debounced || undefined,
        page,
        page_size: pageSize,
      }),
    [status, debounced, page],
  );

  useRealtimeRefresh({ callbacks: callbacks.refresh });

  const data = callbacks.data ?? null;

  async function runReschedule() {
    if (!rescheduleTarget || !rescheduleDate) return;
    setActing(true);
    try {
      await api.updateCallback(rescheduleTarget.id, {
        callback_date: rescheduleDate,
        status: "SCHEDULED",
      });
      toast.success("Callback rescheduled.");
      callbacks.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reschedule the callback.");
    } finally {
      setActing(false);
      setRescheduleTarget(null);
    }
  }

  async function runCancel() {
    if (!cancelTarget) return;
    setActing(true);
    try {
      await api.updateCallback(cancelTarget.id, { status: "CANCELLED" });
      toast.success("Callback cancelled.");
      callbacks.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel the callback.");
    } finally {
      setActing(false);
      setCancelTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Callbacks</h1>
        <p className="text-sm text-muted-foreground">
          Callbacks requested by customers during AI conversations. Times follow the
          campaign&apos;s calling windows.
        </p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} callbacks` : "Loading…"}
              </span>
            }
          >
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Callback date</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Previous outcome</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {callbacks.loading && !data ? (
                  <TableSkeleton rows={8} columns={9} />
                ) : callbacks.error ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="p-4">
                        <ErrorState message={callbacks.error} onRetry={callbacks.refresh} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data && data.items.length === 0 ? (
                  <TableMessage
                    columns={9}
                    icon={CalendarClock}
                    title="No callbacks scheduled"
                    description="Callbacks requested during calls will appear here."
                  />
                ) : (
                  data?.items.map((callback) => (
                    <TableRow key={callback.id}>
                      <TableCell className="text-sm font-medium">
                        {callback.customer_name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{callback.phone ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(callback.callback_date ?? callback.updated_at)}
                      </TableCell>
                      <TableCell className="text-xs">{callback.callback_window ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                        {callback.reason ?? "—"}
                      </TableCell>
                      <TableCell><OutcomeBadge value={callback.previous_outcome} /></TableCell>
                      <TableCell className="text-right tabular-nums">{callback.attempts}</TableCell>
                      <TableCell><CallbackStatusBadge value={callback.status} /></TableCell>
                      <TableCell>
                        {allowed("callback.manage") &&
                        ["SCHEDULED", "DUE"].includes(callback.status.toUpperCase()) ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRescheduleTarget(callback);
                                setRescheduleDate(callback.callback_date?.slice(0, 10) ?? "");
                              }}
                            >
                              Reschedule
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setCancelTarget(callback)}>
                              Cancel
                            </Button>
                          </div>
                        ) : null}
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
            disabled={callbacks.loading}
          />
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={rescheduleTarget !== null}
        onOpenChange={(open) => (open ? null : setRescheduleTarget(null))}
        title="Reschedule callback"
        description={`Pick a new date for ${rescheduleTarget?.customer_name ?? "this customer"}'s callback. The calling window from the campaign still applies.`}
        confirmLabel="Reschedule"
        destructive={false}
        loading={acting}
        onConfirm={() => void runReschedule()}
      >
        <div className="py-2">
          <Label htmlFor="cb-date">New callback date</Label>
          <Input
            id="cb-date"
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
          />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => (open ? null : setCancelTarget(null))}
        title="Cancel this callback?"
        description="The customer will not be called back as scheduled. This cannot be undone."
        confirmLabel="Cancel callback"
        loading={acting}
        onConfirm={() => void runCancel()}
      />
    </div>
  );
}
