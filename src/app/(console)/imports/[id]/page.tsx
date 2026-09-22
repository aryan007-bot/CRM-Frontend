"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { ImportStatusBadge } from "@/components/status-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api, ApiError } from "@/lib/api";
import { canWrite, useAuth } from "@/lib/auth";
import { formatDateTime, humanize } from "@/lib/format";
import type { ColumnMapping, MappingField, ValidateResult } from "@/lib/types";

const UNMAPPED = "__unmapped__";

const FIELDS: { key: MappingField; label: string; required: boolean; hint: string }[] = [
  { key: "customer_name", label: "Customer name", required: true, hint: "Debtor's full name" },
  { key: "phone", label: "Phone", required: true, hint: "Normalized to +91XXXXXXXXXX" },
  { key: "account_number", label: "Account number", required: true, hint: "Unique per organization" },
  { key: "outstanding_amount", label: "Outstanding amount", required: true, hint: "Decimal, e.g. 25000.50" },
  { key: "due_date", label: "Due date", required: false, hint: "Optional" },
  { key: "creditor_name", label: "Creditor", required: false, hint: "Created if missing" },
  { key: "email", label: "Email", required: false, hint: "Optional" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}

function CountCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ImportDetailPage() {
  const params = useParams<{ id: string }>();
  const importId = params?.id;
  const { user } = useAuth();
  const writable = canWrite(user);

  // `null` means "use the server's suggestions". Once the user edits a field we
  // keep their explicit mapping, so no effect is needed to seed the form.
  const [mappingEdits, setMappingEdits] = useState<ColumnMapping | null>(null);
  const [validation, setValidation] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const job = useApi(importId ? () => api.getImport(importId) : null, [importId]);
  const data = job.data;

  const suggestedMapping = useMemo<ColumnMapping>(() => {
    const seeded: ColumnMapping = {};
    for (const field of FIELDS) {
      const suggested = data?.suggested_mapping[field.key];
      if (suggested) seeded[field.key] = suggested;
    }
    return seeded;
  }, [data]);

  const mapping = mappingEdits ?? suggestedMapping;

  const missingRequired = useMemo(
    () => FIELDS.filter((field) => field.required && !mapping[field.key]).map((f) => f.label),
    [mapping],
  );

  const isCompleted = data?.status === "completed";

  async function handleValidate() {
    if (!importId || validating) return;
    if (missingRequired.length > 0) {
      setActionError(`Map the required fields first: ${missingRequired.join(", ")}.`);
      return;
    }

    setValidating(true);
    setActionError(null);
    try {
      const result = await api.validateImport(importId, mapping);
      setValidation(result);
      job.refresh();
      toast.success(
        `Validated: ${result.summary.valid_rows} valid, ${result.summary.invalid_rows} invalid, ${result.summary.duplicate_rows} duplicate.`,
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  }

  async function handleConfirm() {
    if (!importId || confirming) return;
    setConfirming(true);
    setActionError(null);
    try {
      const result = await api.confirmImport(importId);
      toast.success(`Import complete — ${result.imported_rows} row(s) imported.`);
      setValidation(null);
      job.refresh();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not confirm the import.",
      );
      job.refresh();
    } finally {
      setConfirming(false);
      setConfirmOpen(false);
    }
  }

  if (job.loading && !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={job.error ?? "Import not found."} onRetry={job.refresh} />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/imports">
              <ArrowLeft className="size-4" />
              Back to imports
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const canConfirm = Boolean(
    validation && validation.summary.valid_rows > 0 && validation.summary.invalid_rows === 0,
  );
  const validRowsInFile = data.valid_rows > 0;
  const hasBlockingErrors = data.invalid_rows > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={data.filename}
        description={`${humanize(data.file_type)} upload · ${data.total_rows} row(s) · ${formatDateTime(data.created_at)}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/imports">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      {actionError ? (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Import status
            <ImportStatusBadge status={data.status} />
          </CardTitle>
          <CardDescription>
            {isCompleted
              ? "This import has been committed. Confirming again is rejected by the server."
              : "Mapping and validation happen before anything is written to the database."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard label="Total rows" value={data.total_rows} />
          <CountCard label="Valid" value={data.valid_rows} tone="success" />
          <CountCard label="Invalid" value={data.invalid_rows} tone="danger" />
          <CountCard label="Duplicate" value={data.duplicate_rows} tone="warning" />
        </CardContent>
      </Card>

      {isCompleted ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Imported {data.imported_rows} row(s)
            </CardTitle>
            <CardDescription>
              Customers, phone numbers, creditors and accounts were created in a single
              transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/customers">View customers</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/accounts">View accounts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              Detected columns: {data.detected_columns.join(", ") || "none"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`map-${field.key}`} className="flex items-center gap-2">
                    {field.label}
                    {field.required ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Required
                      </Badge>
                    ) : null}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? UNMAPPED}
                    onValueChange={(value) =>
                      setMappingEdits((current) => ({
                        ...(current ?? suggestedMapping),
                        [field.key]: value === UNMAPPED ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger id={`map-${field.key}`} className="w-full">
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                      {data.detected_columns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void handleValidate()} disabled={!writable || validating}>
                {validating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {validating ? "Validating…" : "Validate"}
              </Button>
              {!writable ? (
                <span className="text-xs text-muted-foreground">
                  Your role can view imports but not run them.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {validation ? (
        <>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Validation result</CardTitle>
              <CardDescription>
                {validation.summary.valid_rows} row(s) ready to import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <CountCard label="Total" value={validation.summary.total_rows} />
                <CountCard label="Valid" value={validation.summary.valid_rows} tone="success" />
                <CountCard label="Invalid" value={validation.summary.invalid_rows} tone="danger" />
                <CountCard
                  label="Duplicate"
                  value={validation.summary.duplicate_rows}
                  tone="warning"
                />
              </div>

              {validation.warnings.map((warning) => (
                <Alert key={warning}>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}

              {validation.errors.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Problem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.errors.slice(0, 50).map((error, index) => (
                        <TableRow key={`${error.row}-${error.field}-${index}`}>
                          <TableCell className="tabular-nums">{error.row}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {error.field}
                          </TableCell>
                          <TableCell className="text-sm">
                            {error.message}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({error.code})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validation.errors.length > 50 ? (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      Showing the first 50 of {validation.errors.length} problems.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {validation.preview.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Preview of the first {validation.preview.length} valid row(s)
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(validation.preview[0]).map((key) => (
                            <TableHead key={key} className="whitespace-nowrap">
                              {key.replace(/_/g, " ")}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.preview.map((row, index) => (
                          <TableRow key={index}>
                            {Object.keys(validation.preview[0]).map((key) => (
                              <TableCell key={key} className="whitespace-nowrap text-xs">
                                {row[key] === null || row[key] === undefined
                                  ? "—"
                                  : String(row[key])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Commit this import</CardTitle>
              <CardDescription>
                {hasBlockingErrors
                  ? "Rows with errors must be fixed in the source file before importing. Nothing is written while errors remain."
                  : canConfirm
                    ? "Writes customers, phone numbers, creditors and accounts in one transaction."
                    : "Validate again after resolving problems."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canConfirm || !writable || hasBlockingErrors}
              >
                <CheckCircle2 className="size-4" />
                Confirm import
              </Button>
              {!canConfirm && !hasBlockingErrors && !validRowsInFile ? (
                <span className="text-xs text-muted-foreground">
                  No valid rows to import.
                </span>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {data.total_rows} row(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates customers, phone numbers, creditors and accounts. It is an
              all-or-nothing transaction and cannot be run twice for the same file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={confirming}
            >
              {confirming ? "Importing…" : "Yes, import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Field label="Import ID" value={<span className="font-mono text-xs">{data.id}</span>} />
        <Field label="Last updated" value={formatDateTime(data.updated_at)} />
      </div>
    </div>
  );
}
