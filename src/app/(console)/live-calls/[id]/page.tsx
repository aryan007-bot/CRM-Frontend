"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import type { CallDetail, CallDisposition, CallStatus, TranscriptMessage, WebSocketEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/page-states";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Headphones,
  Mic,
  MicOff,
  Pause,
  PhoneForwarded,
  PhoneOff,
  Play,
  Radio,
  Send,
  User,
} from "lucide-react";

export default function LiveCallDetailPage() {
  const params = useParams();
  const callId = params?.id as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetExt, setTargetExt] = useState("agent-support-queue");
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<CallDisposition>("COMPLETED");
  const [dispositionNotes, setDispositionNotes] = useState("");
  const [acting, setActing] = useState(false);

  // Interactive utterance simulator input
  const [simText, setSimText] = useState("");
  const [simSpeaker, setSimSpeaker] = useState<"ai" | "customer" | "agent">("customer");

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const loadCall = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    api.getLiveCall(callId).then(
      (data) => {
        if (!cancelled) {
          setCall(data);
          setTranscripts(data.transcripts || []);
          setIsMuted(false);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load call detail");
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [callId, refreshKey]);

  // WebSocket event handler
  const handleWsEvent = useCallback(
    (wsEvent: WebSocketEvent) => {
      if (wsEvent.call_id !== callId) return;

      if (wsEvent.event.startsWith("call.")) {
        const payload = wsEvent.data as Record<string, unknown> | undefined;
        const toStatus = payload?.to_status as CallStatus | undefined;
        if (toStatus) {
          setCall((prev) => (prev ? { ...prev, status: toStatus } : null));
        }
        if (wsEvent.event === "call.muted") {
          setIsMuted(Boolean(payload?.muted));
        }
      } else if (wsEvent.event === "transcript.final" || wsEvent.event === "transcript.partial") {
        const item = wsEvent.data as {
          id?: string;
          speaker?: "customer" | "agent" | "ai" | "system";
          text?: string;
          is_final?: boolean;
          timestamp?: string;
        } | undefined;
        if (!item?.text) return;
        const textVal = item.text;
        setTranscripts((prev) => {
          // Avoid duplicate keys
          if (item.id && prev.some((t) => t.id === item.id)) {
            return prev.map((t) => (t.id === item.id ? { ...t, text: textVal, is_final: item.is_final ?? true } : t));
          }
          return [
            ...prev,
            {
              id: item.id || `msg-${Date.now()}`,
              call_id: callId,
              speaker: item.speaker || "ai",
              text: textVal,
              is_final: item.is_final ?? true,
              confidence: null,
              start_time_offset: null,
              end_time_offset: null,
              timestamp: item.timestamp || new Date().toISOString(),
            },
          ];
        });
      }
    },
    [callId]
  );

  const { connectionState } = useLiveCallSocket({
    onEvent: handleWsEvent,
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Controls
  const toggleMute = async () => {
    if (!call) return;
    try {
      if (isMuted) {
        await api.unmuteLiveCall(call.id);
        setIsMuted(false);
        toast.success("Audio unmuted");
      } else {
        await api.muteLiveCall(call.id);
        setIsMuted(true);
        toast.info("Audio muted");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Mute toggle failed");
    }
  };

  const toggleHold = async () => {
    if (!call) return;
    try {
      if (call.status === "on_hold") {
        const updated = await api.resumeLiveCall(call.id);
        setCall((prev) => (prev ? { ...prev, status: updated.status } : null));
        toast.success("Call resumed");
      } else {
        const updated = await api.holdLiveCall(call.id);
        setCall((prev) => (prev ? { ...prev, status: updated.status } : null));
        toast.info("Call placed on hold");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hold toggle failed");
    }
  };

  const handleTransfer = async () => {
    if (!call) return;
    setActing(true);
    try {
      const updated = await api.transferLiveCall(call.id, { target_extension: targetExt });
      setCall((prev) => (prev ? { ...prev, status: updated.status } : null));
      setTransferOpen(false);
      toast.success("Call transferred to human agent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setActing(false);
    }
  };

  const handleEndCall = async () => {
    if (!call) return;
    try {
      const updated = await api.endLiveCall(call.id);
      setCall((prev) => (prev ? { ...prev, status: updated.status } : null));
      toast.info("Call ended");
      setDispositionOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "End call failed");
    }
  };

  const handleSaveDisposition = async () => {
    if (!call) return;
    setActing(true);
    try {
      const updated = await api.setLiveCallDisposition(call.id, {
        disposition: selectedDisposition,
        notes: dispositionNotes,
      });
      setCall((prev) => (prev ? { ...prev, disposition: updated.disposition } : null));
      setDispositionOpen(false);
      toast.success("Call disposition saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save disposition");
    } finally {
      setActing(false);
    }
  };

  const handleSendSimTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!call || !simText.trim()) return;
    try {
      await api.appendLiveCallTranscript(call.id, {
        speaker: simSpeaker,
        text: simText.trim(),
        is_final: true,
      });
      setSimText("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading call session...</div>;
  }

  if (error || !call) {
    return <ErrorState message={error || "Call session not found"} onRetry={loadCall} />;
  }

  const isTerminal = call.status === "ended" || call.status === "failed";

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/live-calls">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Call with {call.customer_name || call.recipient_phone}
              </h1>
              <Badge
                variant={
                  connectionState === "LIVE"
                    ? "default"
                    : connectionState === "RECONNECTING"
                    ? "secondary"
                    : "outline"
                }
                className={connectionState === "LIVE" ? "bg-emerald-600 animate-pulse" : ""}
              >
                {connectionState}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">ID: {call.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {call.disposition && (
            <Badge variant="secondary" className="px-3 py-1">
              Disposition: {call.disposition}
            </Badge>
          )}
          {isTerminal && !call.disposition && (
            <Button size="sm" onClick={() => setDispositionOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-1" /> Set Disposition
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: CRM Debt Context + Live Transcript + Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: CRM Context & Session Metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer & Debt Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Customer Name</span>
                <p className="font-medium">{call.customer_name || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Phone Number</span>
                <p className="font-mono">{call.recipient_phone}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Account Number</span>
                <p className="font-mono">{call.account_number || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Outstanding Balance</span>
                <p className="font-semibold text-destructive">
                  {call.outstanding_amount ? `₹${call.outstanding_amount}` : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Assigned AI Agent</span>
                <p className="font-medium flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  {call.agent_name || "Default Assistant"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Call Controls Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Call Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleMute}
                  disabled={isTerminal}
                >
                  {isMuted ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
                <Button
                  variant={call.status === "on_hold" ? "default" : "outline"}
                  size="sm"
                  onClick={toggleHold}
                  disabled={isTerminal}
                >
                  {call.status === "on_hold" ? (
                    <Play className="h-4 w-4 mr-1" />
                  ) : (
                    <Pause className="h-4 w-4 mr-1" />
                  )}
                  {call.status === "on_hold" ? "Resume" : "Hold"}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={() => setTransferOpen(true)}
                disabled={isTerminal || call.status === "human_connected"}
              >
                <PhoneForwarded className="h-4 w-4 mr-1" /> Transfer to Human Agent
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleEndCall}
                disabled={isTerminal}
              >
                <PhoneOff className="h-4 w-4 mr-1" /> End Call
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right 2 Columns: Live Transcript Stream */}
        <div className="md:col-span-2 space-y-4">
          <Card className="flex flex-col h-[520px]">
            <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                <CardTitle className="text-sm font-semibold">Real-Time Dialogue Stream</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Status: {call.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcripts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Waiting for conversation to begin...
                </div>
              ) : (
                transcripts.map((t) => (
                  <div
                    key={t.id}
                    className={`flex gap-2.5 max-w-[85%] ${
                      t.speaker === "ai"
                        ? "mr-auto"
                        : t.speaker === "customer"
                        ? "ml-auto flex-row-reverse"
                        : "mx-auto"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white ${
                        t.speaker === "ai"
                          ? "bg-blue-600"
                          : t.speaker === "customer"
                          ? "bg-emerald-600"
                          : "bg-purple-600"
                      }`}
                    >
                      {t.speaker === "ai" ? (
                        <Bot className="h-4 w-4" />
                      ) : t.speaker === "customer" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Headphones className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-lg text-sm shadow-sm ${
                        t.speaker === "ai"
                          ? "bg-muted text-foreground"
                          : t.speaker === "customer"
                          ? "bg-primary text-primary-foreground"
                          : "bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-[10px] font-semibold uppercase opacity-75">
                          {t.speaker}
                        </span>
                        {!t.is_final && (
                          <span className="text-[10px] italic opacity-60">speaking...</span>
                        )}
                      </div>
                      <p className="leading-relaxed">{t.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </CardContent>

            {/* Live Utterance Simulator Bar */}
            <div className="p-3 border-t bg-muted/30">
              <form onSubmit={handleSendSimTranscript} className="flex gap-2">
                <Select
                  value={simSpeaker}
                  onValueChange={(v: "ai" | "customer" | "agent") => setSimSpeaker(v)}
                >
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="ai">AI Agent</SelectItem>
                    <SelectItem value="agent">Human Agent</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-9"
                  placeholder="Feed dialogue utterance in real time..."
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                />
                <Button type="submit" size="sm" className="h-9">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer to Human Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Route this live channel directly to a senior recovery agent or Asterisk queue.
            </p>
            <div>
              <Label htmlFor="target-queue">Target Queue / Extension</Label>
              <Input
                id="target-queue"
                value={targetExt}
                onChange={(e) => setTargetExt(e.target.value)}
                placeholder="e.g. sip:102@pbx.local or agent-support-queue"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTransfer} disabled={acting}>
                {acting ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disposition Modal */}
      <Dialog open={dispositionOpen} onOpenChange={setDispositionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Call Disposition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="disp-select">Outcome</Label>
              <Select
                value={selectedDisposition}
                onValueChange={(val: CallDisposition) => setSelectedDisposition(val)}
              >
                <SelectTrigger id="disp-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">COMPLETED (Agreed / Resolved)</SelectItem>
                  <SelectItem value="CALLBACK">CALLBACK (Customer requested later call)</SelectItem>
                  <SelectItem value="TRANSFERRED">TRANSFERRED (Escalated to human)</SelectItem>
                  <SelectItem value="WRONG_NUMBER">WRONG_NUMBER (Incorrect contact)</SelectItem>
                  <SelectItem value="NO_ANSWER">NO_ANSWER (Ringing but no pickup)</SelectItem>
                  <SelectItem value="BUSY">BUSY (Line busy)</SelectItem>
                  <SelectItem value="FAILED">FAILED (Network failure / dropped)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Operator Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={dispositionNotes}
                onChange={(e) => setDispositionNotes(e.target.value)}
                placeholder="Key commitments, payment promise dates, or customer remarks..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDispositionOpen(false)}>
                Skip / Close
              </Button>
              <Button onClick={handleSaveDisposition} disabled={acting}>
                {acting ? "Saving..." : "Save Outcome"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
