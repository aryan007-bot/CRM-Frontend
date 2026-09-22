"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { ImportStatusBadge } from "@/components/status-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { api, ApiError } from "@/lib/api";
import { canWrite, useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

const IMPORT_STATUSES = ["uploaded", "processing", "completed", "partially_completed", "failed"];

export default function ImportsPage() {
  const { user } = useAuth();
  const writable = canWrite(user);
  const router = useRouter();

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const imports = useApi(
    () =>
      api.listImports({
        status: status === "all" ? undefined : status,
        page,
        page_size: pageSize,
      }),
    [status, page, pageSize],
  );

  const data = imports.data;

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".xlsx"].includes(extension)) {
      setError("Only .csv and .xlsx files are supported.");
      return;
    }
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadImport(file);
      toast.success(`${result.row_count} rows detected in ${result.filename}.`);
      router.push(`/imports/${result.import_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Imports"
        description="Upload a portfolio spreadsheet, map its columns, then validate before committing."
        actions={
          writable ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Uploading…" : "Upload file"}
              </Button>
            </>
          ) : null
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {IMPORT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {imports.error ? (
              <div className="ml-auto">
                <ErrorState message={imports.error} onRetry={imports.refresh} compact />
              </div>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} imports` : "Loading…"}
              </span>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Valid</TableHead>
                <TableHead className="text-right">Invalid</TableHead>
                <TableHead className="text-right">Duplicate</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.loading && !data ? (
                <TableSkeleton rows={4} columns={8} />
              ) : !imports.error && data && data.items.length === 0 ? (
                <TableMessage
                  columns={8}
                  icon={FileSpreadsheet}
                  title="No imports yet"
                  description="Upload a CSV or XLSX file with customer, phone, account and amount columns."
                  action={
                    writable ? (
                      <Button size="sm" onClick={() => fileInput.current?.click()}>
                        <Upload className="size-4" />
                        Upload file
                      </Button>
                    ) : null
                  }
                />
              ) : (
                data?.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/imports/${job.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {job.filename}
                      </Link>
                      <p className="text-xs text-muted-foreground uppercase">{job.file_type}</p>
                    </TableCell>
                    <TableCell>
                      <ImportStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{job.total_rows}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {job.valid_rows}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {job.invalid_rows}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {job.duplicate_rows}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{job.imported_rows}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(job.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.page_size ?? pageSize}
            total={data?.total ?? 0}
            onPageChange={setPage}
            disabled={imports.loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
