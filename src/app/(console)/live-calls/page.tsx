"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
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
import { ErrorState, EmptyState, TableSkeleton } from "@/components/page-states";
import { toast } from "sonner";
import { PhoneCall, Play, Radio, RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/use-api";

export default function LiveCallsPage() {
  const state = useApi(() => api.listLiveCalls(undefined, 1, 50), []);
  const calls = state.data?.items ?? [];
  const loading = state.loading;
  const error = state.error;
  const fetchCalls = state.refresh;

  // New call modal
  const [callOpen, setCallOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [dialing, setDialing] = useState(false);

  const loadCustomers = async () => {
    try {
      const res = await api.listCustomers({ page: 1, page_size: 50 });
      setCustomers(res.items);
      if (res.items.length > 0) {
        setSelectedCustomerId(res.items[0].id);
        const primaryPhone = res.items[0].phones.find((p) => p.is_primary)?.normalized_phone || res.items[0].phones[0]?.normalized_phone;
        setPhone(primaryPhone || "");
      }
    } catch {
      // Ignored
    }
  };

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !phone.trim()) {
      toast.error("Customer and valid phone number are required");
      return;
    }

    setDialing(true);
    try {
      await api.createLiveCall({
        customer_id: selectedCustomerId,
        recipient_phone: phone.trim(),
      });
      toast.success("Call initiated successfully");
      setCallOpen(false);
      fetchCalls();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate call");
    } finally {
      setDialing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
      case "ai_talking":
      case "customer_talking":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 animate-pulse">{status}</Badge>;
      case "ringing":
      case "connecting":
        return <Badge variant="secondary">{status}</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="border-amber-500 text-amber-600">{status}</Badge>;
      case "human_connected":
      case "transferring":
        return <Badge className="bg-purple-600">{status}</Badge>;
      case "ended":
        return <Badge variant="outline">{status}</Badge>;
      case "failed":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Calls & Dispositions</h1>
          <p className="text-sm text-muted-foreground">
            Monitor real-time voice interactions, AI dialogue state, and execute transfers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCalls()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              loadCustomers();
              setCallOpen(true);
            }}
          >
            <PhoneCall className="h-4 w-4 mr-1" /> Initiate Call
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCalls} />
      ) : calls.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-10 w-10 text-muted-foreground" />}
          title="No call sessions recorded"
          description="Initiate an outbound call to open the real-time AI conversation and live transcript stream."
          action={
            <Button
              onClick={() => {
                loadCustomers();
                setCallOpen(true);
              }}
            >
              <PhoneCall className="h-4 w-4 mr-1" /> Initiate Call
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calls ({calls.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.customer_name || "Unknown Customer"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.recipient_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.duration_seconds}s
                    </TableCell>
                    <TableCell>
                      {c.disposition ? (
                        <Badge variant="secondary">{c.disposition}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/live-calls/${c.id}`}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Open Console
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Start Call Dialog */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Outbound Call</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStartCall} className="space-y-4 py-2">
            <div>
              <Label htmlFor="customer-select">Select Customer</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={(val) => {
                  setSelectedCustomerId(val);
                  const cust = customers.find((c) => c.id === val);
                  const p = cust?.phones.find((x) => x.is_primary)?.normalized_phone || cust?.phones[0]?.normalized_phone;
                  if (p) setPhone(p);
                }}
              >
                <SelectTrigger id="customer-select">
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.name} ({cust.phones[0]?.normalized_phone || "No phone"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="phone">Recipient Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCallOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={dialing}>
                {dialing ? "Dialing..." : "Start Call"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
