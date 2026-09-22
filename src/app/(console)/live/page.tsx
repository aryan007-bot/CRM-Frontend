"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Headset, RadioTower, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { LiveStateBadge, SentimentBadge } from "@/components/status-badges";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { LiveCall } from "@/lib/types";

const POLL_MS = 5000;

function LiveTimer({ startSec }: { startSec: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{formatDuration(startSec + tick)}</span>;
}

export default function LiveConsolePage() {
  const [calls, setCalls] = useState<LiveCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [takeoverTarget, setTakeoverTarget] = useState<LiveCall | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await api.listLiveCalls();
      setCalls(result);
      setError(null);
    } catch {
      setError("Lost connection to the dialer. Retrying…");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const poll = () => void load();
    const immediate = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, [load]);

  async function confirmTakeover() {
    if (!takeoverTarget) return;
    try {
      await api.takeoverLiveCall();
      toast.success(`Call ${takeoverTarget.id} transferred to your headset.`);
      await load();
    } catch {
      toast.error("Takeover failed — try again.");
    } finally {
      setTakeoverTarget(null);
    }
  }

  const talking = calls?.filter((c) => c.state === "talking").length ?? 0;
  const dialing = calls?.filter((c) => c.state === "dialing").length ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Live Console"
        description="Real-time view of calls in flight. Polls every 5 seconds."
        actions={
          <Button variant="outline" onClick={load} disabled={refreshing}>
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      />

      {/* Status strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {calls ? `${talking} talking` : "—"} · {calls ? `${dialing} dialing` : "—"}
        </span>
        <span className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          <RadioTower className="size-4" />
          {calls ? `${calls.length} lines in use` : "…"}
        </span>
        <span className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Bot className="size-4" />
          AI handling {calls ? Math.round((calls.filter((c) => c.agent.startsWith("Ava")).length / Math.max(calls.length, 1)) * 100) : 0}%
        </span>
      </div>

      {error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : !calls ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm font-medium">No calls in flight</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Active campaigns will appear here once the dialing window opens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {calls.map((call) => (
            <Card key={call.id} className="gap-4 py-5">
              <CardContent className="space-y-4 px-5">
                <div className="flex items-center justify-between">
                  <LiveStateBadge state={call.state} />
                  <span className="font-mono text-xs text-muted-foreground">{call.id}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Contact {call.contactId}</p>
                    <p className="text-xs text-muted-foreground">
                      Campaign {call.campaignId}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <LiveTimer startSec={call.elapsedSec} />
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI confidence</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(call.aiConfidence * 100)}%
                    </span>
                  </div>
                  <Progress value={call.aiConfidence * 100} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between">
                  <SentimentBadge sentiment={call.sentiment} />
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {call.agent.startsWith("Ava") ? (
                            <Bot className="size-3.5" />
                          ) : (
                            <Headset className="size-3.5" />
                          )}
                          {call.agent}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Handling agent</TooltipContent>
                    </Tooltip>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTakeoverTarget(call)}
                    >
                      <Headset className="size-3.5" /> Take over
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={takeoverTarget !== null} onOpenChange={(o) => !o && setTakeoverTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take over call {takeoverTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              The AI will brief you with a one-line summary and drop to listening
              mode. The contact stays on the line.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTakeover}>Join call</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
