"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CallTable } from "@/components/call-table";
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
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { CallOutcome } from "@/lib/types";

const OUTCOME_FILTERS: { value: CallOutcome | "all"; label: string }[] = [
  { value: "all", label: "All outcomes" },
  { value: "ai_resolved", label: "AI resolved" },
  { value: "promise_to_pay", label: "Promise to pay" },
  { value: "human_takeover", label: "Human takeover" },
  { value: "callback_scheduled", label: "Callback scheduled" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "busy", label: "Busy" },
  { value: "failed", label: "Failed" },
];

const PAGE_SIZE = 10;

export default function CallsPage() {
  const [outcome, setOutcome] = useState<CallOutcome | "all">("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const campaigns = useApi(() => api.listCampaigns(), []);
  const calls = useApi(
    () => api.listCalls({ outcome, campaignId, search: query, page, pageSize: PAGE_SIZE }),
    [outcome, campaignId, query, page],
  );

  const data = calls.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Calls & Transcripts"
        description="Full dial history with AI outcomes and conversation transcripts."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <form
              className="relative min-w-56 flex-1 sm:max-w-xs"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search);
                setPage(1);
              }}
            >
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by call id…"
                className="pl-8"
                aria-label="Search calls"
              />
            </form>
            <Select
              value={outcome}
              onValueChange={(v) => {
                setOutcome(v as CallOutcome | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={campaignId}
              onValueChange={(v) => {
                setCampaignId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {data ? `${data.total} calls` : "…"}
            </span>
          </div>

          <div className="px-4">
            {calls.loading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : data ? (
              <CallTable calls={data.items} />
            ) : (
              <p className="py-16 text-center text-sm text-destructive">{calls.error}</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || calls.loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || calls.loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
