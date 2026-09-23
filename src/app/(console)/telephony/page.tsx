"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { TelephonyGatewayCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, TableSkeleton } from "@/components/page-states";
import { toast } from "sonner";
import { Activity, Plus, Radio, RefreshCw, Signal, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/use-api";

export default function TelephonyPage() {
  const state = useApi(async () => {
    const [tStatus, aStatus, gws] = await Promise.all([
      api.getTelephonyStatus(),
      api.getAiStatus(),
      api.listTelephonyGateways(1, 50),
    ]);
    return { tStatus, aStatus, gateways: gws.items };
  }, []);

  const telephonyStatus = state.data?.tStatus ?? null;
  const aiStatus = state.data?.aStatus ?? null;
  const gateways = state.data?.gateways ?? [];
  const loading = state.loading;
  const error = state.error;
  const fetchData = state.refresh;

  // Gateway modal
  const [createOpen, setCreateOpen] = useState(false);
  const [gwForm, setGwForm] = useState<TelephonyGatewayCreate>({
    name: "",
    gateway_type: "GSM",
    host: "192.168.1.100",
    port: 5060,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gwForm.name.trim()) {
      toast.error("Gateway name is required");
      return;
    }

    setSubmitting(true);
    try {
      await api.createTelephonyGateway(gwForm);
      toast.success("Telephony gateway added");
      setCreateOpen(false);
      setGwForm({ name: "", gateway_type: "GSM", host: "192.168.1.100", port: 5060 });
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add gateway");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telephony & AI Subsystems</h1>
          <p className="text-sm text-muted-foreground">
            Hardware PBX connectivity, GSM/SIP trunk gateways, and AI inference latency health.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Gateway
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableSkeleton rows={4} columns={4} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          {/* Top Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  Asterisk ARI / PBX
                </CardTitle>
                <Radio className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{telephonyStatus?.asterisk_status}</div>
                <p className="text-xs text-muted-foreground mt-1">Active channels: {telephonyStatus?.active_channels}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  GSM Trunks Online
                </CardTitle>
                <Signal className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {telephonyStatus?.gateways_online} / {telephonyStatus?.gateways_total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Available SIM gateways</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  AI Pipeline Health
                </CardTitle>
                <Sparkles className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiStatus?.overall_status}</div>
                <p className="text-xs text-muted-foreground mt-1">STT · LLM · TTS · VAD</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  Target Inference Latency
                </CardTitle>
                <Activity className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">~225ms</div>
                <p className="text-xs text-muted-foreground mt-1">Combined turn-taking target</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Subsystems Card Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI Services & Provider Routing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {aiStatus?.services.map((svc) => (
                  <div key={svc.service_type} className="p-3 border rounded-lg bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{svc.service_type}</span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                        {svc.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Provider: <span className="font-medium text-foreground">{svc.provider}</span>
                    </div>
                    {svc.model && (
                      <div className="text-xs text-muted-foreground truncate">
                        Model: <span className="font-mono text-foreground">{svc.model}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Latency: <span className="font-mono font-medium text-foreground">{svc.latency_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gateways Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Registered Trunks & Gateways ({gateways.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gateway Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Host Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signal Strength</TableHead>
                    <TableHead>Active Channels</TableHead>
                    <TableHead>Last Heartbeat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateways.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                        No trunks registered yet. Add a GSM or SIP gateway to begin routing calls.
                      </TableCell>
                    </TableRow>
                  ) : (
                    gateways.map((gw) => (
                      <TableRow key={gw.id}>
                        <TableCell className="font-medium">{gw.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{gw.gateway_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {gw.host}:{gw.port}
                        </TableCell>
                        <TableCell>
                          <Badge variant={gw.status === "ONLINE" ? "default" : "destructive"}>
                            {gw.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {gw.signal_strength !== null ? `${gw.signal_strength}%` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{gw.active_channels}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(gw.last_seen_at).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Gateway Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Telephony Gateway</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateGateway} className="space-y-4 py-2">
            <div>
              <Label htmlFor="gw-name">Gateway Name</Label>
              <Input
                id="gw-name"
                value={gwForm.name}
                onChange={(e) => setGwForm({ ...gwForm, name: e.target.value })}
                placeholder="e.g. GSM Trunk Mumbai 1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gw-type">Type</Label>
                <Select
                  value={gwForm.gateway_type}
                  onValueChange={(val) => setGwForm({ ...gwForm, gateway_type: val })}
                >
                  <SelectTrigger id="gw-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GSM">GSM (gsm2sip / Android)</SelectItem>
                    <SelectItem value="SIP">SIP Trunk</SelectItem>
                    <SelectItem value="WEBRTC">WebRTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="gw-port">Port</Label>
                <Input
                  id="gw-port"
                  type="number"
                  value={gwForm.port}
                  onChange={(e) => setGwForm({ ...gwForm, port: parseInt(e.target.value) || 5060 })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="gw-host">Host / IP Address</Label>
              <Input
                id="gw-host"
                value={gwForm.host}
                onChange={(e) => setGwForm({ ...gwForm, host: e.target.value })}
                placeholder="192.168.1.100 or sip.carrier.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Registering..." : "Save Gateway"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
