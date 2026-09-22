"use client";

/**
 * Campaign Exports tab (spec §24) — export centre. The frontend only starts
 * export jobs and downloads generated files; file generation happens on the
 * backend.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { ExportStatusBadge } from "@/components/recovery-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { api, ApiError } from "@/lib/api";
import { can, type Capability } from "@/lib/capabilities";
import { formatCount, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const EXPORT_TYPES = [
  { value: "campaign_leads", label: "Campaign leads" },
  { value: "call_outcomes", label: "Call outcomes" },
  { value: "ptp_report", label: "PTP report" },
  { value: "callback_report", label: "Callback report" },
  { value: "dispute_report", label: "Dispute report" },
  { value: "payment_intent_report", label: "Payment intent report" },
  { value: "recovery_analytics", label: "Recovery analytics" },
  { value: "full_campaign_report", label: "Full campaign report" },
];

export default function CampaignExportsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const { user } = useAuth();
  const allowed = (capability: Capability) => can(capability, user?.roles);

  const [exportType, setExportType] = useState("campaign_leads");
  const [fileFormat, setFileFormat] = useState<"csv" | "xlsx">("xlsx");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const exports = useApi(
    campaignId ? () => api.listExports({ campaign_id: campaignId }) : null,
    [campaignId],
  );

  useRealtimeRefresh({ exports: exports.refresh }, { refreshMs: 30_000 });

  const data = exports.data ?? null;

  async function runPreview() {
    if (!campaignId) return;
    setPreviewing(true);
    try {
      const preview = await api.previewExport({
        export_type: exportType,
        file_format: fileFormat,
        campaign_id: campaignId,
        filters: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
      });
      setPreviewCount(preview.row_count);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not preview the row count.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runCreate() {
    if (!campaignId) return;
    setCreating(true);
    try {
      await api.createExport({
        export_type: exportType,
        file_format: fileFormat,
        campaign_id: campaignId,
        filters: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
      });
      toast.success("Export generation started. It will appear below when ready.");
      exports.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start the export.");
    } finally {
      setCreating(false);
    }
  }

  async function download(id: string) {
    setDownloadingId(id);
    try {
      await api.downloadExport(id);
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {allowed("export.create") ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate export</CardTitle>
            <CardDescription>
              Select a report, review the row count, then generate. Files are produced by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <Label>Export type</Label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger aria-label="Export type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Format</Label>
                <Select
                  value={fileFormat}
                  onValueChange={(value) => setFileFormat(value as "csv" | "xlsx")}
                >
                  <SelectTrigger aria-label="File format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="exp-from">From</Label>
                <Input
                  id="exp-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="exp-to">To</Label>
                <Input
                  id="exp-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => void runPreview()} disabled={previewing}>
                {previewing ? <Loader2 className="size-4 animate-spin" /> : null}
                Preview row count
              </Button>
              <Button onClick={() => void runCreate()} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                Generate export
              </Button>
              {previewCount !== null ? (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatCount(previewCount)} rows match
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Export history</CardTitle>
          <CardDescription>Generated files for this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {exports.loading && !data ? (
                <TableSkeleton rows={4} columns={7} />
              ) : exports.error ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="p-4">
                      <ErrorState message={exports.error} onRetry={exports.refresh} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length === 0 ? (
                <TableMessage
                  columns={7}
                  icon={FileSpreadsheet}
                  title="No exports yet"
                  description="Generate your first export above."
                />
              ) : (
                data?.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(job.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {EXPORT_TYPES.find((t) => t.value === job.export_type)?.label ??
                        job.export_type}
                    </TableCell>
                    <TableCell className="text-xs uppercase">{job.file_format}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.row_count === null ? "—" : formatCount(job.row_count)}
                    </TableCell>
                    <TableCell className="text-xs">{job.created_by_name ?? "—"}</TableCell>
                    <TableCell>
                      <ExportStatusBadge value={job.status} />
                      {job.error_message ? (
                        <p className="mt-1 max-w-64 text-xs text-destructive">{job.error_message}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {allowed("export.download") &&
                      job.status.toUpperCase() === "COMPLETED" &&
                      job.filename ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === job.id}
                          onClick={() => void download(job.id)}
                        >
                          {downloadingId === job.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          Download
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
