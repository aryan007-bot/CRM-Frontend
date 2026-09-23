"use client";

/**
 * Smart Routing (spec §20 + §21).
 *
 * Displays the backend's routing chain as an operational pipeline and manages
 * typed fallback rules. Conditions and actions are closed enums — the client
 * never evaluates routing logic or accepts arbitrary expressions; the backend
 * remains authoritative.
 */

import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { RoutingPipeline, SectionCard, UpdatedAt } from "@/components/phase4/phase4-parts";

import { DangerActionDialog, type DangerActionContext } from "@/components/phase4/danger-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useLiveCallSocket } from "@/hooks/use-live-call-socket";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { routingApi } from "@/lib/phase4-api";
import { targetsForEvent } from "@/lib/phase4-realtime";
import { ApiError } from "@/lib/api";
import { environmentLabel } from "@/lib/phase4-format";
import { ROUTING_CONDITION_LABELS } from "@/lib/phase4-meta";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { RoutingActionType, RoutingCondition, RoutingRuleInput } from "@/lib/phase4-types";

const SERVICE_TYPES = ["LLM", "STT", "TTS", "VAD", "EMBEDDING"];
const CONDITIONS: RoutingCondition[] = [
  "PROVIDER_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "TIMEOUT",
  "HIGH_LATENCY",
  "MODEL_UNAVAILABLE",
];
const ACTIONS: RoutingActionType[] = ["ROUTE_TO_PROVIDER", "ROUTE_TO_MODEL", "FAIL_REQUEST"];

export default function RoutingPage() {
  const { user } = useAuth();
  const canManage = can("ai_routing.manage", user?.roles);

  const routing = useApi(() => routingApi.overview(), []);

  const onEvent = (event: { event: string }) => {
    if (targetsForEvent(event.event).includes("phase4:routing")) routing.refresh();
  };
  useLiveCallSocket({ onEvent });

  const data = routing.data;

  // Rule builder state (typed, closed enums only).
  const [serviceType, setServiceType] = useState("LLM");
  const [conditions, setConditions] = useState<RoutingCondition[]>(["PROVIDER_UNAVAILABLE"]);
  const [action, setAction] = useState<RoutingActionType>("ROUTE_TO_MODEL");
  const [targetProviderId, setTargetProviderId] = useState("");
  const [targetModelId, setTargetModelId] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);

  // Deletion confirmation.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function createRule() {
    setSaving(true);
    try {
      const input: RoutingRuleInput = {
        service_type: serviceType,
        conditions,
        action,
        target_provider_id: targetProviderId || null,
        target_model_id: targetModelId || null,
        enabled: true,
        priority: priority ? Number(priority) : null,
      };
      await routingApi.createRule(input);
      toast.success("Routing rule created. The backend applies it to new requests.");
      routing.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the rule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    try {
      await routingApi.updateRule(id, { enabled });
      routing.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function deleteRule(id: string) {
    setBusy(true);
    try {
      await routingApi.deleteRule(id);
      toast.success("Routing rule deleted.");
      routing.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }

  const deleteContext: DangerActionContext | null = pendingDelete
    ? {
        consequence:
          "Requests that matched this rule no longer fall back through it. The remaining chain applies, and unmatched failures fail the request.",
        target: pendingDelete.label,
        environment: environmentLabel(),
        currentState: "enabled",
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="AI Routing"
        description="Provider/model selection order and fallback rules. The backend evaluates routing; this UI configures it."
        actions={<UpdatedAt at={data?.updated_at} />}
      />

      {routing.error ? (
        <ErrorState message={routing.error} onRetry={routing.refresh} />
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          <SectionCard
            title="Routing pipeline"
            description="Request flows through the chain top-down; each hop activates on the triggers listed."
          >
            <RoutingPipeline
              steps={data.chain.map((s) => ({
                position: s.position,
                role: s.role,
                label: `${s.provider_name ?? "?"} / ${s.model_name ?? "?"}`,
                state: s.state,
                triggers: s.fallback_triggers.map(
                  (t) => ROUTING_CONDITION_LABELS[t] ?? t.toLowerCase().replace(/_/g, " "),
                ),
              }))}
            />
          </SectionCard>

          <SectionCard title="Fallback rules" description="Typed conditions only — no arbitrary expressions.">
            <ul className="space-y-2">
              {data.rules.map((rule) => (
                <li key={rule.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">{rule.service_type}</span>
                    <span className="text-sm font-medium">
                      WHEN {rule.conditions.map((c) => ROUTING_CONDITION_LABELS[c] ?? c).join(" OR ").toLowerCase()}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {canManage ? (
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(v) => void toggleRule(rule.id, v)}
                          aria-label={`Rule ${rule.id} enabled`}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{rule.enabled ? "enabled" : "disabled"}</span>
                      )}
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive"
                          onClick={() => setPendingDelete({ id: rule.id, label: `${rule.service_type} rule` })}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    THEN{" "}
                    {rule.action === "FAIL_REQUEST"
                      ? "fail the request"
                      : `route to ${rule.target_label ?? rule.target_model_id ?? rule.target_provider_id}`}{" "}
                    · priority {rule.priority ?? "—"} · updated {formatDateTime(rule.updated_at)}
                  </p>
                </li>
              ))}
              {data.rules.length === 0 ? (
                <p className="text-xs text-muted-foreground">No routing rules configured.</p>
              ) : null}
            </ul>
          </SectionCard>

          {canManage ? (
            <SectionCard title="Add rule" description="Build a structured fallback rule from typed conditions.">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-service">Service</Label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger id="rule-service"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Fallback if (any of)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CONDITIONS.map((c) => {
                        const active = conditions.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setConditions((prev) =>
                                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                              )
                            }
                            className={
                              active
                                ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium"
                                : "rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                            }
                          >
                            {ROUTING_CONDITION_LABELS[c]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rule-action">Then</Label>
                    <Select value={action} onValueChange={(v) => setAction(v as RoutingActionType)}>
                      <SelectTrigger id="rule-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((a) => (
                          <SelectItem key={a} value={a}>{a.replace(/_/g, " ").toLowerCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {action !== "FAIL_REQUEST" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="rule-provider">Target provider id</Label>
                        <Input
                          id="rule-provider"
                          value={targetProviderId}
                          onChange={(e) => setTargetProviderId(e.target.value)}
                          placeholder="prv-openai"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rule-model">Target model id</Label>
                        <Input
                          id="rule-model"
                          value={targetModelId}
                          onChange={(e) => setTargetModelId(e.target.value)}
                          placeholder="mdl-gpt4o-mini"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label htmlFor="rule-priority">Priority</Label>
                    <Input
                      id="rule-priority"
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      placeholder="1"
                    />
                  </div>

                  <Button onClick={() => void createRule()} disabled={saving || conditions.length === 0}>
                    {saving ? "Creating…" : "Create rule"}
                  </Button>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="mb-2 font-semibold">Rule preview</p>
                  <pre className="overflow-x-auto font-mono whitespace-pre-wrap text-[11px]">
{`WHEN ${serviceType} request
FALLBACK IF:
${conditions.map((c) => `  - ${ROUTING_CONDITION_LABELS[c]}`).join("\n") || "  - (none selected)"}
THEN:
  ${
    action === "FAIL_REQUEST"
      ? "fail the request"
      : `${action === "ROUTE_TO_MODEL" ? "model" : "provider"} ${
          action === "ROUTE_TO_MODEL" ? targetModelId || "(model id)" : targetProviderId || "(provider id)"
        }`
  }`}
                  </pre>
                </div>
              </div>
            </SectionCard>
          ) : (
            <p className="text-xs text-muted-foreground">You have view-only access to routing.</p>
          )}
        </>
      )}

      {deleteContext ? (
        <DangerActionDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => (open ? null : setPendingDelete(null))}
          actionLabel="Delete routing rule"
          context={deleteContext}
          onConfirm={() => void deleteRule(pendingDelete!.id)}
          loading={busy}
        />
      ) : null}
    </div>
  );
}
