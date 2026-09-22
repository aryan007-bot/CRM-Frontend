"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Campaign } from "@/lib/types";

const CAMPAIGN_STATUSES = ["draft", "ready", "running", "paused", "completed", "archived"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "UTC", "America/New_York", "Europe/London"];

/** "09:00:00" -> "09:00" for an <input type="time">. */
function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

function CampaignForm({
  campaign,
  onOpenChange,
  onSaved,
}: {
  campaign: Campaign | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(campaign);
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [timezone, setTimezone] = useState(campaign?.timezone ?? "Asia/Kolkata");
  const [startTime, setStartTime] = useState(
    campaign ? toTimeInput(campaign.calling_start_time) : "09:00",
  );
  const [endTime, setEndTime] = useState(
    campaign ? toTimeInput(campaign.calling_end_time) : "18:00",
  );
  const [maxAttempts, setMaxAttempts] = useState(String(campaign?.max_attempts ?? 3));
  const [retryDelay, setRetryDelay] = useState(String(campaign?.retry_delay_minutes ?? 60));
  const [concurrency, setConcurrency] = useState(String(campaign?.concurrency_limit ?? 5));
  const [status, setStatus] = useState(campaign?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (startTime >= endTime) {
      setError("Calling start time must be earlier than the end time.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      timezone,
      // Seconds are required by the backend time type.
      calling_start_time: `${startTime}:00`,
      calling_end_time: `${endTime}:00`,
      max_attempts: Number(maxAttempts),
      retry_delay_minutes: Number(retryDelay),
      concurrency_limit: Number(concurrency),
    };

    try {
      if (campaign) {
        await api.updateCampaign(campaign.id, { ...payload, status });
        toast.success("Campaign updated.");
      } else {
        await api.createCampaign(payload);
        toast.success("Campaign created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the campaign.");
    } finally {
      setSaving(false);
    }
  }  return (
    <>
        <form id="campaign-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Q4 high-value recovery"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for your team"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="campaign-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit ? (
              <div className="space-y-1.5">
                <Label htmlFor="campaign-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="campaign-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-start">Calling starts</Label>
              <Input
                id="campaign-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-end">Calling ends</Label>
              <Input
                id="campaign-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-attempts">Max attempts</Label>
              <Input
                id="campaign-attempts"
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(event) => setMaxAttempts(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-retry">Retry delay (min)</Label>
              <Input
                id="campaign-retry"
                type="number"
                min={1}
                value={retryDelay}
                onChange={(event) => setRetryDelay(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-concurrency">Concurrency</Label>
              <Input
                id="campaign-concurrency"
                type="number"
                min={1}
                max={100}
                value={concurrency}
                onChange={(event) => setConcurrency(event.target.value)}
              />
            </div>
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
        <Button type="submit" form="campaign-form" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create campaign"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CampaignDialog({
  open,
  onOpenChange,
  campaign = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Calling windows are validated against the campaign timezone. No calls are placed in
            Phase 1.
          </DialogDescription>
        </DialogHeader>
        <CampaignForm
          campaign={campaign}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
