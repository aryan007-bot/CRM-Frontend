"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Campaign, DialMode, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const DIAL_MODES: { value: DialMode; label: string; hint: string }[] = [
  {
    value: "predictive",
    label: "Predictive",
    hint: "Dials ahead of agent availability; maximum throughput.",
  },
  {
    value: "progressive",
    label: "Progressive",
    hint: "Dials fixed batches sized to available agents.",
  },
  {
    value: "preview",
    label: "Preview",
    hint: "Shows the contact first; the agent confirms each dial.",
  },
];

function HourSelect({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {Array.from({ length: 24 }, (_, h) => (
            <SelectItem key={h} value={String(h)}>
              {((h + 11) % 12) + 1}:00 {h < 12 ? "AM" : "PM"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CampaignDialog({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null; // null = create mode
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dialMode, setDialMode] = useState<DialMode>("progressive");
  const [concurrency, setConcurrency] = useState(20);
  const [maxAttempts, setMaxAttempts] = useState(4);
  const [days, setDays] = useState<Weekday[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(18);
  const [saving, setSaving] = useState(false);

  const resetFromCampaign = (c: Campaign | null) => {
    if (c) {
      setName(c.name);
      setDescription(c.description);
      setDialMode(c.dialMode);
      setConcurrency(c.concurrency);
      setMaxAttempts(c.maxAttempts);
      setDays(c.schedule.days);
      setStartHour(c.schedule.startHour);
      setEndHour(c.schedule.endHour);
    } else {
      setName("");
      setDescription("");
      setDialMode("progressive");
      setConcurrency(20);
      setMaxAttempts(4);
      setDays(["mon", "tue", "wed", "thu", "fri"]);
      setStartHour(9);
      setEndHour(18);
    }
  };

  useEffect(() => {
    if (open) setTimeout(() => resetFromCampaign(campaign), 0);
  }, [open, campaign]);

  const toggleDay = (d: Weekday) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Give the campaign a name.");
      return;
    }
    if (days.length === 0) {
      toast.error("Select at least one dialing day.");
      return;
    }
    if (endHour <= startHour) {
      toast.error("End hour must be after start hour.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        status: campaign?.status ?? "draft",
        dialMode,
        concurrency,
        maxAttempts,
        schedule: {
          days,
          startHour,
          endHour,
          timezone: campaign?.schedule.timezone ?? "America/New_York",
        },
      };
      if (campaign) {
        await api.updateCampaign(campaign.id, payload);
        toast.success("Campaign updated.");
      } else {
        await api.createCampaign(payload);
        toast.success("Campaign created as a draft. Add contacts, then activate.");
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Could not save the campaign. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const activeMode = DIAL_MODES.find((m) => m.value === dialMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            {campaign
              ? "Update dialing rules and schedule."
              : "Drafts stay idle until you activate them."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Card Recovery"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-desc">Description</Label>
            <Textarea
              id="campaign-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who is this campaign calling, and why?"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Dialing mode</Label>
            <Select value={dialMode} onValueChange={(v) => setDialMode(v as DialMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAL_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeMode ? (
              <p className="text-xs text-muted-foreground">{activeMode.hint}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-concurrency">Max lines</Label>
              <Input
                id="campaign-concurrency"
                type="number"
                min={1}
                max={200}
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-attempts">Max attempts</Label>
              <Input
                id="campaign-attempts"
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dialing days</Label>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    days.includes(d.key)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HourSelect label="Start" value={startHour} onChange={setStartHour} />
            <HourSelect label="End" value={endHour} onChange={setEndHour} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Compliance guardrails</p>
              <p className="text-xs text-muted-foreground">
                Quiet hours &amp; attempt caps are enforced org-wide in Settings.
              </p>
            </div>
            <Switch checked disabled aria-label="Compliance guardrails" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : campaign ? "Save changes" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
