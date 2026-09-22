"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ContactStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { api } from "@/lib/api";
import { formatCurrency, formatRelative, initials } from "@/lib/format";
import type { ContactStatus } from "@/lib/types";
import { ContactSheet } from "./contact-sheet";

const STATUS_FILTERS: { value: ContactStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "promised_to_pay", label: "Promised to pay" },
  { value: "payment_arranged", label: "Payment arranged" },
  { value: "callback", label: "Callback" },
  { value: "disputed", label: "Disputed" },
  { value: "do_not_call", label: "Do not call" },
  { value: "closed", label: "Closed" },
];

const PAGE_SIZE = 10;

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const contacts = useApi(
    () => api.listContacts({ search: query, status, page, pageSize: PAGE_SIZE }),
    [query, status, page],
  );

  const data = contacts.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function submitSearch() {
    setQuery(search);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Contacts"
        description="Synthetic account records with compliance flags — no real PII."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <form
              className="relative min-w-56 flex-1 sm:max-w-xs"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, account, phone…"
                className="pl-8"
                aria-label="Search contacts"
              />
            </form>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as ContactStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {data ? `${data.total} contacts` : "…"}
            </span>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Debt age</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Last contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.loading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.items.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">
                            {initials(c.firstName, c.lastName)}
                          </span>
                          <div>
                            <p className="font-medium">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.accountRef}
                      </TableCell>
                      <TableCell>
                        <ContactStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(c.balanceDue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.debtAgeDays}d
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.attempts}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(c.lastContactedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              {!contacts.loading && data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-sm font-medium">No contacts match</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different search or filter.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || contacts.loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || contacts.loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ContactSheet
        contactId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSaved={() => contacts.refresh()}
      />
    </div>
  );
}
