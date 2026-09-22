"use client";

/**
 * Automation rule builder (spec §19) — simple structured WHEN → IF → THEN
 * composition. Deliberately forms, not a visual programming system.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import type {
  AutomationCondition,
  AutomationRule,
} from "@/lib/types";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_CONDITION_FIELDS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/lib/recovery";

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "≤" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "≥" },
  { value: "within_days", label: "within (days)" },
] as const;

export function RuleForm({ rule }: { rule?: AutomationRule }) {
  const router = useRouter();
  const editing = rule !== undefined;

  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? "NO_ANSWER");
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    rule?.conditions ?? [],
  );
  const [action, setAction] = useState(rule?.action ?? "SCHEDULE_RETRY");
  const [delayMinutes, setDelayMinutes] = useState(
    String(rule?.action_config?.delay_minutes ?? 60),
  );
  const [campaignId, setCampaignId] = useState(rule?.campaign_id ?? "");
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCondition() {
    setConditions((current) => [
      ...current,
      { field: AUTOMATION_CONDITION_FIELDS[0].value, operator: "eq", value: "" },
    ]);
  }

  function updateCondition(index: number, values: Partial<AutomationCondition>) {
    setConditions((current) =>
      current.map((condition, i) => (i === index ? { ...condition, ...values } : condition)),
    );
  }

  async function submit() {
    if (name.trim().length < 3) {
      setError("Give the rule a descriptive name (at least 3 characters).");
      return;
    }
    setSaving(true);
    setError(null);
    const action_config: Record<string, string | number | boolean | null> = {};
    if (delayMinutes !== "") action_config.delay_minutes = Number(delayMinutes);

    try {
      const payload = {
        name: name.trim(),
        description: description || null,
        trigger,
        conditions,
        action,
        action_config,
        campaign_id: campaignId || null,
        is_active: isActive,
      };
      if (editing && rule) {
        await api.updateAutomationRule(rule.id, payload);
        toast.success("Rule updated.");
      } else {
        await api.createAutomationRule(payload);
        toast.success("Rule created.");
      }
      router.push("/automation/rules");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rule details</CardTitle>
          <CardDescription>Name and scope of the rule.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="rule-name">Rule name *</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Retry no-answer leads after 4 hours"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="rule-desc">Description</Label>
            <Textarea
              id="rule-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Campaign scope</Label>
            <CampaignSelect value={campaignId} onChange={setCampaignId} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch id="rule-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="rule-active">{isActive ? "Active" : "Paused"}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WHEN</CardTitle>
          <CardDescription>The event that triggers this rule.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger className="w-72" aria-label="Trigger event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AUTOMATION_TRIGGER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IF</CardTitle>
          <CardDescription>
            Optional conditions. All must match for the action to run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conditions — always runs.</p>
          ) : (
            conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) => updateCondition(index, { field: value })}
                >
                  <SelectTrigger size="sm" className="w-52" aria-label="Condition field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_CONDITION_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(index, { operator: value as AutomationCondition["operator"] })
                  }
                >
                  <SelectTrigger size="sm" className="w-40" aria-label="Condition operator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((operator) => (
                      <SelectItem key={operator.value} value={operator.value}>
                        {operator.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 w-28"
                  inputMode={
                    ["lt", "lte", "gt", "gte", "within_days"].includes(condition.operator)
                      ? "numeric"
                      : undefined
                  }
                  value={String(condition.value ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const numeric = ["lt", "lte", "gt", "gte", "within_days"].includes(
                      condition.operator,
                    );
                    updateCondition(index, {
                      value: numeric ? (raw === "" ? null : Number(raw)) : raw,
                    });
                  }}
                  aria-label="Condition value"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove condition"
                  onClick={() =>
                    setConditions((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={addCondition}>
            <Plus className="size-4" />
            Add condition
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>THEN</CardTitle>
          <CardDescription>The action to run when the rule matches.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full" aria-label="Action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUTOMATION_ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-delay">Delay (minutes)</Label>
            <Input
              id="rule-delay"
              inputMode="numeric"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {editing ? "Save changes" : "Create rule"}
        </Button>
      </div>
    </div>
  );
}

function CampaignSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const campaigns = useApi(() => api.listCampaigns({ page_size: 100 }), []);
  return (
    <Select value={value || "all"} onValueChange={(next) => onChange(next === "all" ? "" : next)}>
      <SelectTrigger className="w-full" aria-label="Campaign scope">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All campaigns</SelectItem>
        {(campaigns.data?.items ?? []).map((campaign) => (
          <SelectItem key={campaign.id} value={campaign.id}>
            {campaign.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
