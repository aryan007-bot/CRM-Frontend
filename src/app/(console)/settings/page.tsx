"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { OrgSettings, Weekday } from "@/lib/types";
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

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
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
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch(() => setError("Could not load settings."));
  }, []);

  function update(mutate: (draft: OrgSettings) => void) {
    setSettings((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      mutate(draft);
      setDirty(true);
      return draft;
    });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await api.updateSettings(settings);
      setSettings(saved);
      setDirty(false);
      toast.success("Settings saved.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <p className="py-24 text-center text-sm text-destructive">{error}</p>;
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Organization profile, AI persona, and compliance guardrails."
        actions={
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Identity used in AI scripts and disclosures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Business name</Label>
              <Input
                id="org-name"
                value={settings.businessName}
                onChange={(e) => update((d) => void (d.businessName = e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) => update((d) => void (d.timezone = v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dialing days</Label>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = settings.dialingDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() =>
                      update((draft) => {
                        draft.dialingDays = on
                          ? draft.dialingDays.filter((x) => x !== d.key)
                          : [...draft.dialingDays, d.key];
                      })
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HourSelect
              label="Window start"
              value={settings.dialingStartHour}
              onChange={(v) => update((d) => void (d.dialingStartHour = v))}
            />
            <HourSelect
              label="Window end"
              value={settings.dialingEndHour}
              onChange={(v) => update((d) => void (d.dialingEndHour = v))}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI persona */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>AI persona</CardTitle>
          <CardDescription>
            How the voice agent introduces itself and handles conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-name">Agent name</Label>
              <Input
                id="ai-name"
                value={settings.ai.personaName}
                onChange={(e) => update((d) => void (d.ai.personaName = e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Voice model</Label>
              <Select
                value={settings.ai.voiceModel}
                onValueChange={(v) => update((d) => void (d.ai.voiceModel = v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aurora-voice-v3">Aurora Voice v3</SelectItem>
                  <SelectItem value="cascade-tts-2">Cascade TTS 2</SelectItem>
                  <SelectItem value="nimbus-neural-1">Nimbus Neural 1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Speech rate — {settings.ai.speechRate.toFixed(1)}×</Label>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={settings.ai.speechRate}
                onChange={(e) =>
                  update((d) => void (d.ai.speechRate = Number(e.target.value)))
                }
                className="w-full accent-[var(--primary)]"
                aria-label="Speech rate"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empathy level</Label>
              <Select
                value={settings.ai.empathyLevel}
                onValueChange={(v) =>
                  update((d) => void (d.ai.empathyLevel = v as OrgSettings["ai"]["empathyLevel"]))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — direct and brief</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="high">High — extra validation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-script">Greeting script</Label>
            <Textarea
              id="ai-script"
              rows={3}
              value={settings.ai.greetingScript}
              onChange={(e) => update((d) => void (d.ai.greetingScript = e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{{agent}}"}, {"{{company}}"}, {"{{contact_first_name}}"}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Escalate to human on request</p>
              <p className="text-xs text-muted-foreground">
                Transfer immediately when the contact asks for a person.
              </p>
            </div>
            <Switch
              checked={settings.ai.escalationToHuman}
              onCheckedChange={(v) => update((d) => void (d.ai.escalationToHuman = v))}
              aria-label="Escalate to human"
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>
            TCPA / FDCPA guardrails enforced by the dialer before every call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <HourSelect
              label="Quiet hours start"
              value={settings.compliance.quietHours.startHour}
              onChange={(v) => update((d) => void (d.compliance.quietHours.startHour = v))}
            />
            <HourSelect
              label="Quiet hours end"
              value={settings.compliance.quietHours.endHour}
              onChange={(v) => update((d) => void (d.compliance.quietHours.endHour = v))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="max-attempts">Max attempts / day</Label>
              <Input
                id="max-attempts"
                type="number"
                min={1}
                max={10}
                value={settings.compliance.maxAttemptsPerDay}
                onChange={(e) =>
                  update(
                    (d) =>
                      void (d.compliance.maxAttemptsPerDay = Math.max(
                        1,
                        Number(e.target.value),
                      )),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-days">Days between attempts</Label>
              <Input
                id="min-days"
                type="number"
                min={0}
                max={14}
                value={settings.compliance.minDaysBetweenAttempts}
                onChange={(e) =>
                  update(
                    (d) =>
                      void (d.compliance.minDaysBetweenAttempts = Math.max(
                        0,
                        Number(e.target.value),
                      )),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purge">Recording purge (days)</Label>
              <Input
                id="purge"
                type="number"
                min={30}
                max={3650}
                value={settings.compliance.autoPurgeDays}
                onChange={(e) =>
                  update(
                    (d) =>
                      void (d.compliance.autoPurgeDays = Math.max(
                        30,
                        Number(e.target.value),
                      )),
                  )
                }
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Recording disclosure</p>
              <p className="text-xs text-muted-foreground">
                AI states “this call may be recorded” at connect.
              </p>
            </div>
            <Switch
              checked={settings.compliance.recordingDisclosure}
              onCheckedChange={(v) =>
                update((d) => void (d.compliance.recordingDisclosure = v))
              }
              aria-label="Recording disclosure"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Honor national DNC list</p>
              <p className="text-xs text-muted-foreground">
                Skip numbers on the federal do-not-call registry.
              </p>
            </div>
            <Switch
              checked={settings.compliance.honorDncList}
              onCheckedChange={(v) => update((d) => void (d.compliance.honorDncList = v))}
              aria-label="Honor DNC list"
            />
          </div>

          <p className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            Compliance settings are stubbed in Phase 1 and stored client-side only.
            Wire them to FastAPI + the policy engine before production dialing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
