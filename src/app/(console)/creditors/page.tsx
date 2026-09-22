"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Landmark, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, TableMessage, TableSkeleton } from "@/components/page-states";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const CREDITOR_TONES: Record<string, "success" | "muted"> = {
  active: "success",
  inactive: "muted",
};

function CreditorForm({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await api.createCreditor(name.trim());
      toast.success("Creditor created.");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the creditor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <form id="creditor-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="creditor-name">Name</Label>
            <Input
              id="creditor-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="HDFC Bank"
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form="creditor-form" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Create creditor"}
        </Button>
      </DialogFooter>
    </>
  );
}

function NewCreditorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New creditor</DialogTitle>
          <DialogDescription>
            Creditor names must be unique within your organization.
          </DialogDescription>
        </DialogHeader>
        <CreditorForm onOpenChange={onOpenChange} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function CreditorSheet({
  creditorId,
  open,
  onOpenChange,
}: {
  creditorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const creditor = useApi(creditorId ? () => api.getCreditor(creditorId) : null, [creditorId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{creditor.data?.name ?? "Creditor"}</SheetTitle>
          <SheetDescription>Creditor details</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {creditor.error ? (
            <ErrorState message={creditor.error} onRetry={creditor.refresh} compact />
          ) : creditor.data ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge
                  value={creditor.data.status}
                  toneMap={CREDITOR_TONES}
                />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(creditor.data.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last updated</p>
                <p className="text-sm">{formatDateTime(creditor.data.updated_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Identifier</p>
                <p className="font-mono text-xs break-all">{creditor.data.id}</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/accounts?creditor_id=${creditor.data.id}`}>
                  <ExternalLink className="size-4" />
                  View this creditor&apos;s accounts
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CreditorsPage() {
  const { user } = useAuth();
  const writable = canWrite(user);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const creditors = useApi(
    () => api.listCreditors({ search: search || undefined, page, page_size: pageSize }),
    [search, page, pageSize],
  );

  const data = creditors.data;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Creditors"
        description="Lenders and institutions whose portfolios you recover."
        actions={
          writable ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New creditor
            </Button>
          ) : null
        }
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <form
            className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="relative min-w-56 flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search creditors…"
                className="pl-8"
                aria-label="Search creditors"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {search ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            ) : null}
            {creditors.error ? (
              <div className="ml-auto">
                <ErrorState message={creditors.error} onRetry={creditors.refresh} compact />
              </div>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {data ? `${data.total} creditors` : "Loading…"}
              </span>
            )}
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditors.loading && !data ? (
                <TableSkeleton rows={5} columns={4} />
              ) : !creditors.error && data && data.items.length === 0 ? (
                <TableMessage
                  columns={4}
                  icon={Landmark}
                  title={search ? "No creditors match" : "No creditors yet"}
                  description={
                    search
                      ? "Try a different search term."
                      : "Creditors are created here or automatically during an import."
                  }
                  action={
                    !search && writable ? (
                      <Button size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="size-4" />
                        New creditor
                      </Button>
                    ) : null
                  }
                />
              ) : (
                data?.items.map((creditor) => (
                  <TableRow key={creditor.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedId(creditor.id)}
                        className="text-sm font-medium hover:underline"
                      >
                        {creditor.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={creditor.status} toneMap={CREDITOR_TONES} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(creditor.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${creditor.name}`}
                        onClick={() => setSelectedId(creditor.id)}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
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
            disabled={creditors.loading}
          />
        </CardContent>
      </Card>

      <NewCreditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setPage(1);
          creditors.refresh();
        }}
      />

      <CreditorSheet
        creditorId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
