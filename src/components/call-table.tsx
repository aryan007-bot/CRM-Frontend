"use client";

import { useState } from "react";
import { Bot, Eye, PhoneCall, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { api } from "@/lib/api";
import { formatDuration, formatRelative } from "@/lib/format";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OutcomeBadge, SentimentBadge } from "@/components/status-badges";

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptDialog({
  call,
  open,
  onOpenChange,
}: {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!call) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="size-4 text-muted-foreground" />
            Call {call.id}
          </DialogTitle>
          <DialogDescription>
            {formatRelative(call.startedAt)} · {formatDuration(call.durationSec)} ·{" "}
            {call.outcome.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {call.aiSummary ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">AI wrap-up</p>
              {call.aiSummary}
            </div>
          ) : null}
          {call.transcript.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No transcript — the call never connected.
            </p>
          ) : (
            <ScrollArea className="h-72 rounded-lg border p-3">
              <div className="space-y-3">
                {call.transcript.map((turn, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex max-w-[85%] gap-2",
                      turn.speaker === "contact" ? "ml-auto flex-row-reverse" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        turn.speaker === "ai"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      {turn.speaker === "ai" ? (
                        <Bot className="size-3.5" />
                      ) : (
                        <User className="size-3.5" />
                      )}
                    </span>
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        turn.speaker === "ai"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      <p className="text-[10px] opacity-70">{mmss(turn.atSec)}</p>
                      {turn.text}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CallTable({
  calls,
  compact = false,
}: {
  calls: Call[];
  compact?: boolean;
}) {
  const names = useApi(() => api.getNameMaps(), []);
  const [selected, setSelected] = useState<Call | null>(null);

  if (names.loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const contactNames = names.data?.contacts ?? {};
  const campaignNames = names.data?.campaigns ?? {};

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {compact ? null : <TableHead>Call</TableHead>}
            <TableHead>Contact</TableHead>
            {compact ? null : <TableHead>Campaign</TableHead>}
            <TableHead>Outcome</TableHead>
            {compact ? null : <TableHead>Sentiment</TableHead>}
            {compact ? null : <TableHead className="text-right">Duration</TableHead>}
            <TableHead className="text-right">When</TableHead>
            {compact ? null : <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              {compact ? null : (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {call.id}
                </TableCell>
              )}
              <TableCell className="font-medium">
                {contactNames[call.contactId] ?? call.contactId}
              </TableCell>
              {compact ? null : (
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {campaignNames[call.campaignId] ?? call.campaignId}
                </TableCell>
              )}
              <TableCell>
                <OutcomeBadge outcome={call.outcome} />
              </TableCell>
              {compact ? null : (
                <TableCell>
                  <SentimentBadge sentiment={call.sentiment} />
                </TableCell>
              )}
              {compact ? null : (
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDuration(call.durationSec)}
                </TableCell>
              )}
              <TableCell className="text-right text-muted-foreground">
                {formatRelative(call.startedAt)}
              </TableCell>
              {compact ? null : (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`View transcript for ${call.id}`}
                    onClick={() => setSelected(call)}
                  >
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {calls.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={compact ? 3 : 8}
                className="h-24 text-center text-muted-foreground"
              >
                No calls match the current filters.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <TranscriptDialog
        call={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
