"use client";

/**
 * Six-step campaign wizard (spec §6).
 *
 * Steps validate independently with zod; the final submit is only enabled
 * when every step is valid. The backend remains authoritative — server
 * errors (e.g. CALLING_POLICY_BLOCKED) surface on the review step.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DEFAULT_WIZARD_CONFIG,
  campaignWizardSchema,
  toCampaignCreate,
  type CampaignWizardConfig,
} from "@/lib/campaign-config";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  AUTOMATION_ACTION_LABELS,
  CAMPAIGN_TYPES,
  LANGUAGES,
  FOLLOW_UP_TRIGGERS,
} from "@/lib/recovery";
import { cn } from "@/lib/utils";

const STEP_LABELS = [
  "Details",
  "Lead source",
  "Dialing",
  "Strategy",
  "Follow-ups",
  "Review",
] as const;

interface CreditorOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  language: string;
  status: string;
}

interface LeadPreview {
  total: number;
  eligible: number;
  blocked: number;
  warnings: number;
  errors: number;
}

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "UTC", "America/New_York", "Europe/London"];

export function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<CampaignWizardConfig>(() =>
    structuredClone(DEFAULT_WIZARD_CONFIG),
  );
  const [creditors, setCreditors] = useState<CreditorOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [preview, setPreview] = useState<LeadPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const validation = useMemo(() => campaignWizardSchema.safeParse(config), [config]);
  const stepErrors = useMemo(() => {
    if (validation.success) return {} as Record<string, string[]>;
    const flat = validation.error.issues;
    const byStep: Record<string, string[]> = {};
    for (const issue of flat) {
      const key = String(issue.path[0] ?? "");
      (byStep[key] ??= []).push(issue.message);
    }
    return byStep;
  }, [validation]);

  function patch<K extends keyof CampaignWizardConfig>(
    section: K,
    values: Partial<CampaignWizardConfig[K]>,
  ) {
    setConfig((current) => ({ ...current, [section]: { ...current[section], ...values } }));
  }

  // Options + lead preview are fetched lazily on first render of the wizard.
  if (!optionsLoaded && typeof window !== "undefined") {
    setOptionsLoaded(true);
    void (async () => {
      try {
        const [creditorPage, agentPage] = await Promise.all([
          api.listCreditors({ page_size: 100 }),
          api.listAiAgents(),
        ]);
        setCreditors(creditorPage.items.map((c) => ({ id: c.id, name: c.name })));
        setAgents(
          agentPage.items
            .filter((a) => a.status === "READY")
            .map((a) => ({ id: a.id, name: a.name, language: a.language, status: a.status })),
        );
      } catch {
        toast.error("Could not load creditors or AI agents. Check your connection.");
      }
    })();
  }

  async function runPreview() {
    setPreviewing(true);
    try {
      const result = await api.previewCampaignLeads({
        creditor_id: config.details.creditor_id,
        min_outstanding: config.leadSource.filters.min_outstanding || null,
        max_outstanding: config.leadSource.filters.max_outstanding || null,
        due_date_from: config.leadSource.filters.due_date_from || null,
        due_date_to: config.leadSource.filters.due_date_to || null,
        min_days_overdue: config.leadSource.filters.min_days_overdue ?? null,
        account_status: config.leadSource.filters.account_status || null,
        previous_outcome: config.leadSource.filters.previous_outcome || null,
        ptp_status: config.leadSource.filters.ptp_status || null,
        callback_status: config.leadSource.filters.callback_status || null,
        payment_status: config.leadSource.filters.payment_status || null,
      });
      setPreview(result.stats);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not run the lead preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function submit(status: "draft" | "ready") {
    const parsed = campaignWizardSchema.safeParse(config);
    if (!parsed.success) {
      toast.error("Fix the highlighted steps before saving.");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const campaign = await api.createCampaign({
        ...toCampaignCreate(parsed.data),
        description: parsed.data.details.description || null,
      });
      toast.success(
        status === "draft"
          ? "Campaign saved as draft."
          : "Campaign created. Add leads, then start it when ready.",
      );
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Could not create the campaign. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const stepInvalid = (key: string) => (touched[step] ? (stepErrors[key] ?? []) : []);

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2" aria-label="Wizard steps">
        {STEP_LABELS.map((label, index) => {
          const state =
            index === step ? "current" : index < step ? "done" : "upcoming";
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  setTouched((t) => ({ ...t, [step]: true, [index]: true }));
                  setStep(index);
                }}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  state === "current" && "border-primary bg-primary text-primary-foreground",
                  state === "done" && "border-primary/40 bg-primary/10 text-foreground",
                  state === "upcoming" && "text-muted-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-4.5 items-center justify-center rounded-full text-[10px]",
                    state === "done" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {state === "done" ? <Check className="size-3" /> : index + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>
            Step {step + 1} · {STEP_LABELS[step]}
          </CardTitle>
          <CardDescription>{STEP_DESCRIPTIONS[step]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <DetailsStep
              config={config}
              creditors={creditors}
              onChange={(values) => patch("details", values)}
            />
          ) : null}

          {step === 1 ? (
            <LeadSourceStep
              config={config}
              preview={preview}
              previewing={previewing}
              errors={stepInvalid("leadSource")}
              onPreview={() => void runPreview()}
              onChange={(values) => patch("leadSource", values)}
            />
          ) : null}

          {step === 2 ? (
            <DialingStep
              config={config}
              errors={stepInvalid("dialing")}
              onChange={(values) => patch("dialing", values)}
            />
          ) : null}

          {step === 3 ? (
            <StrategyStep
              config={config}
              agents={agents}
              errors={stepInvalid("strategy")}
              onChange={(values) => patch("strategy", values)}
            />
          ) : null}

          {step === 4 ? (
            <FollowUpsStep config={config} onChange={(values) => patch("followUps", values)} />
          ) : null}

          {step === 5 ? (
            <ReviewStep
              config={config}
              preview={preview}
              creditorName={
                creditors.find((c) => c.id === config.details.creditor_id)?.name ?? "—"
              }
              agentName={agents.find((a) => a.id === config.strategy.agent_id)?.name ?? "—"}
            />
          ) : null}

          {serverError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{serverError}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || submitting}
              onClick={() => {
                setTouched((t) => ({ ...t, [step]: true }));
                setStep((s) => Math.max(0, s - 1));
              }}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step === STEP_LABELS.length - 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting || !validation.success}
                    onClick={() => void submit("draft")}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting || !validation.success}
                    onClick={() => void submit("ready")}
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Create campaign
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setTouched((t) => ({ ...t, [step]: true }));
                    setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1));
                  }}
                >
                  Continue
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const STEP_DESCRIPTIONS = [
  "Name the campaign, pick the creditor and set its schedule.",
  "Choose which accounts enter this campaign. Blocked leads are never silently included.",
  "Retry and safety policy. These limits are enforced by the backend.",
  "Pick the AI agent and what the conversation should collect.",
  "Automated actions per outcome.",
  "Review everything before creating.",
];

// ---------- Step 1 ----------

function DetailsStep({
  config,
  creditors,
  onChange,
}: {
  config: CampaignWizardConfig;
  creditors: CreditorOption[];
  onChange: (values: Partial<CampaignWizardConfig["details"]>) => void;
}) {
  const d = config.details;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="wiz-name">Campaign name *</Label>
        <Input
          id="wiz-name"
          value={d.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Q3 overdue card recovery"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="wiz-desc">Description</Label>
        <Textarea
          id="wiz-desc"
          value={d.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
        />
      </div>
      <div>
        <Label>Creditor *</Label>
        <Select
          value={d.creditor_id ?? ""}
          onValueChange={(value) => onChange({ creditor_id: value || null })}
        >
          <SelectTrigger aria-label="Creditor">
            <SelectValue placeholder="Choose creditor" />
          </SelectTrigger>
          <SelectContent>
            {creditors.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Campaign type *</Label>
        <Select value={d.campaign_type} onValueChange={(value) => onChange({ campaign_type: value })}>
          <SelectTrigger aria-label="Campaign type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Priority *</Label>
        <Select value={d.priority} onValueChange={(value) => onChange({ priority: value as CampaignWizardConfig["details"]["priority"] })}>
          <SelectTrigger aria-label="Priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Timezone *</Label>
        <Select value={d.timezone} onValueChange={(value) => onChange({ timezone: value })}>
          <SelectTrigger id="campaign-timezone" aria-label="Timezone">
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
      <div>
        <Label htmlFor="wiz-start-date">Start date *</Label>
        <Input
          id="wiz-start-date"
          type="date"
          value={d.start_date}
          onChange={(e) => onChange({ start_date: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="wiz-end-date">End date</Label>
        <Input
          id="wiz-end-date"
          type="date"
          value={d.end_date ?? ""}
          onChange={(e) => onChange({ end_date: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------- Step 2 ----------

function LeadSourceStep({
  config,
  preview,
  previewing,
  errors,
  onPreview,
  onChange,
}: {
  config: CampaignWizardConfig;
  preview: LeadPreview | null;
  previewing: boolean;
  errors: string[];
  onPreview: () => void;
  onChange: (values: Partial<CampaignWizardConfig["leadSource"]>) => void;
}) {
  const s = config.leadSource;
  const f = s.filters;
  const setFilter = (values: Partial<CampaignWizardConfig["leadSource"]["filters"]>) =>
    onChange({ filters: { ...f, ...values } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "filters", label: "Filter-based selection" },
            { value: "accounts", label: "Pick specific accounts" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ source_mode: option.value })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              s.source_mode === option.value
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {s.source_mode === "filters" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="wiz-min-out">Min outstanding</Label>
            <Input
              id="wiz-min-out"
              inputMode="decimal"
              value={f.min_outstanding ?? ""}
              onChange={(e) => setFilter({ min_outstanding: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="wiz-max-out">Max outstanding</Label>
            <Input
              id="wiz-max-out"
              inputMode="decimal"
              value={f.max_outstanding ?? ""}
              onChange={(e) => setFilter({ max_outstanding: e.target.value })}
              placeholder="100000.00"
            />
          </div>
          <div>
            <Label htmlFor="wiz-min-over">Min days overdue</Label>
            <Input
              id="wiz-min-over"
              inputMode="numeric"
              value={f.min_days_overdue ?? ""}
              onChange={(e) =>
                setFilter({
                  min_days_overdue: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="wiz-due-from">Due from</Label>
            <Input
              id="wiz-due-from"
              type="date"
              value={f.due_date_from ?? ""}
              onChange={(e) => setFilter({ due_date_from: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wiz-due-to">Due to</Label>
            <Input
              id="wiz-due-to"
              type="date"
              value={f.due_date_to ?? ""}
              onChange={(e) => setFilter({ due_date_to: e.target.value })}
            />
          </div>
          <div>
            <Label>Previous outcome</Label>
            <Select
              value={f.previous_outcome ?? ""}
              onValueChange={(value) => setFilter({ previous_outcome: value || undefined })}
            >
              <SelectTrigger aria-label="Previous outcome">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Add leads after creating the campaign from its Leads tab — the account picker
          supports search and bulk selection.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onPreview} disabled={previewing}>
          {previewing ? <Loader2 className="size-4 animate-spin" /> : null}
          Preview eligible leads
        </Button>
        {preview ? (
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{preview.eligible}</span> eligible leads
            · {preview.blocked} blocked
            {preview.warnings > 0 ? ` · ${preview.warnings} warnings` : ""}
          </p>
        ) : null}
      </div>

      {preview && preview.blocked > 0 ? (
        <div className="rounded-md border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {preview.blocked} leads will be excluded (missing phone, opted out, duplicate or
          ineligible). They are never dialed.
        </div>
      ) : null}
      {errors.length > 0 ? <FieldErrors errors={errors} /> : null}
    </div>
  );
}

// ---------- Step 3 ----------

function DialingStep({
  config,
  errors,
  onChange,
}: {
  config: CampaignWizardConfig;
  errors: string[];
  onChange: (values: Partial<CampaignWizardConfig["dialing"]>) => void;
}) {
  const d = config.dialing;
  const num = (value: number) => String(value);
  const set = (values: Partial<CampaignWizardConfig["dialing"]>) => onChange(values);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="wiz-max-attempts">Max attempts per lead *</Label>
          <Input
            id="wiz-max-attempts"
            inputMode="numeric"
            value={num(d.max_attempts)}
            onChange={(e) => set({ max_attempts: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label htmlFor="wiz-retry-delay">Delay between attempts (min) *</Label>
          <Input
            id="wiz-retry-delay"
            inputMode="numeric"
            value={num(d.retry_delay_minutes)}
            onChange={(e) => set({ retry_delay_minutes: Number(e.target.value) || 15 })}
          />
        </div>
        <div>
          <Label htmlFor="wiz-cooldown">Cooldown after outcome (min)</Label>
          <Input
            id="wiz-cooldown"
            inputMode="numeric"
            value={num(d.cooldown_minutes)}
            onChange={(e) => set({ cooldown_minutes: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="wiz-daily">Max daily attempts per customer</Label>
          <Input
            id="wiz-daily"
            inputMode="numeric"
            value={num(d.max_daily_attempts)}
            onChange={(e) => set({ max_daily_attempts: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label htmlFor="wiz-campaign-cap">Campaign total attempt cap</Label>
          <Input
            id="wiz-campaign-cap"
            inputMode="numeric"
            value={num(d.campaign_max_attempts)}
            onChange={(e) => set({ campaign_max_attempts: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label htmlFor="campaign-start">Allowed calling window *</Label>
          <div className="flex items-center gap-2">
            <Input
              id="campaign-start"
              type="time"
              value={d.calling_start_time}
              onChange={(e) => set({ calling_start_time: e.target.value })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              aria-label="Calling window end"
              type="time"
              value={d.calling_end_time}
              onChange={(e) => set({ calling_end_time: e.target.value })}
            />
          </div>
        </div>
      </div>

      <fieldset className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Retry on</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={d.retry_on_no_answer}
            onCheckedChange={(v) => set({ retry_on_no_answer: v === true })}
          />
          No answer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={d.retry_on_busy}
            onCheckedChange={(v) => set({ retry_on_busy: v === true })}
          />
          Busy
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={d.retry_on_failed}
            onCheckedChange={(v) => set({ retry_on_failed: v === true })}
          />
          Failed call
        </label>
      </fieldset>

      <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 p-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          Policy &amp; compliance — high-risk settings
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={d.enforce_dnc}
              onCheckedChange={(v) => set({ enforce_dnc: v === true })}
              aria-label="Enforce DNC / opt-out list"
            />
            Enforce DNC / opt-out list
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={d.recording_disclosure}
              onCheckedChange={(v) => set({ recording_disclosure: v === true })}
            />
            Recording disclosure enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={d.ai_disclosure}
              onCheckedChange={(v) => set({ ai_disclosure: v === true })}
            />
            AI disclosure enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={d.identity_verification}
              onCheckedChange={(v) => set({ identity_verification: v === true })}
            />
            Verify customer identity before discussing debt
          </label>
        </div>
      </div>

      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <p>
          Maximum <span className="font-semibold text-foreground">{d.max_attempts}</span> attempts,
          at least <span className="font-semibold text-foreground">{d.retry_delay_minutes}</span>{" "}
          minutes apart, calls only between {d.calling_start_time}–{d.calling_end_time}{" "}
          {config.details.timezone}.
        </p>
      </div>
      {errors.length > 0 ? <FieldErrors errors={errors} /> : null}
    </div>
  );
}

// ---------- Step 4 ----------

function StrategyStep({
  config,
  agents,
  errors,
  onChange,
}: {
  config: CampaignWizardConfig;
  agents: AgentOption[];
  errors: string[];
  onChange: (values: Partial<CampaignWizardConfig["strategy"]>) => void;
}) {
  const s = config.strategy;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>AI agent *</Label>
          <Select
            value={s.agent_id ?? ""}
            onValueChange={(value) => onChange({ agent_id: value || null })}
          >
            <SelectTrigger aria-label="AI agent">
              <SelectValue placeholder="Choose agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.language})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Language preference</Label>
          <Select
            value={s.language}
            onValueChange={(value) => onChange({ language: value as CampaignWizardConfig["strategy"]["language"] })}
          >
            <SelectTrigger aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conversation strategy</Label>
          <Select
            value={s.strategy}
            onValueChange={(value) => onChange({ strategy: value as CampaignWizardConfig["strategy"]["strategy"] })}
          >
            <SelectTrigger aria-label="Conversation strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOFT">Soft</SelectItem>
              <SelectItem value="FIRM">Firm</SelectItem>
              <SelectItem value="EMPATHETIC">Empathetic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Conversation goals
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={s.collect_payment_intent}
            onCheckedChange={(v) => onChange({ collect_payment_intent: v === true })}
          />
          Collect payment intent
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={s.collect_callback}
            onCheckedChange={(v) => onChange({ collect_callback: v === true })}
          />
          Collect callbacks
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={s.handle_disputes}
            onCheckedChange={(v) => onChange({ handle_disputes: v === true })}
          />
          Capture disputes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={s.human_escalation}
            onCheckedChange={(v) => onChange({ human_escalation: v === true })}
          />
          Allow transfer to human agent
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox
            checked={s.follow_ups_enabled}
            onCheckedChange={(v) => onChange({ follow_ups_enabled: v === true })}
          />
          Enable automated follow-ups after the campaign
        </label>
      </fieldset>
      {errors.length > 0 ? <FieldErrors errors={errors} /> : null}
    </div>
  );
}

// ---------- Step 5 ----------

function FollowUpsStep({
  config,
  onChange,
}: {
  config: CampaignWizardConfig;
  onChange: (values: Partial<CampaignWizardConfig["followUps"]>) => void;
}) {
  const rules = config.followUps.rules;

  function update(index: number, values: Partial<(typeof rules)[number]>) {
    const next = rules.map((rule, i) => (i === index ? { ...rule, ...values } : rule));
    onChange({ rules: next });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Automated actions applied to leads after each outcome. Disabled rules leave the
        outcome without an automatic follow-up.
      </p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Outcome</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Delay (min)</th>
              <th className="px-3 py-2 text-right font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.trigger} className="border-t">
                <td className="px-3 py-2 font-medium">{rule.trigger.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">
                  <Select
                    value={rule.action}
                    onValueChange={(value) => update(index, { action: value })}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={`Action for ${rule.trigger}`}
                      className="w-56"
                    >
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
                </td>
                <td className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    className="h-8 w-24"
                    value={String(rule.delay_minutes)}
                    onChange={(e) =>
                      update(index, { delay_minutes: Number(e.target.value) || 0 })
                    }
                    aria-label={`Delay for ${rule.trigger}`}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Checkbox
                    checked={rule.enabled}
                    onCheckedChange={(v) => update(index, { enabled: v === true })}
                    aria-label={`Enable ${rule.trigger} follow-up`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Step 6 ----------

function ReviewStep({
  config,
  preview,
  creditorName,
  agentName,
}: {
  config: CampaignWizardConfig;
  preview: LeadPreview | null;
  creditorName: string;
  agentName: string;
}) {
  const d = config.dialing;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Campaign
        </h3>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Name" value={config.details.name} />
          <Row label="Creditor" value={creditorName} />
          <Row label="Type" value={config.details.campaign_type} />
          <Row label="Priority" value={config.details.priority} />
          <Row label="Timezone" value={config.details.timezone} />
          <Row
            label="Schedule"
            value={`${config.details.start_date}${config.details.end_date ? ` → ${config.details.end_date}` : ""}`}
          />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Leads
        </h3>
        <p>
          {preview
            ? `${preview.eligible} eligible · ${preview.blocked} blocked`
            : "Run the lead preview in step 2 to confirm eligibility counts."}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Dialing policy
        </h3>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Max attempts" value={String(d.max_attempts)} />
          <Row label="Retry delay" value={`${d.retry_delay_minutes} min`} />
          <Row label="Daily cap / customer" value={String(d.max_daily_attempts)} />
          <Row label="Calling window" value={`${d.calling_start_time}–${d.calling_end_time}`} />
          <Row label="DNC enforcement" value={d.enforce_dnc ? "Enabled" : "DISABLED"} />
          <Row label="AI disclosure" value={d.ai_disclosure ? "Enabled" : "Disabled"} />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Recovery strategy
        </h3>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="AI agent" value={agentName} />
          <Row label="Language" value={config.strategy.language} />
          <Row label="Strategy" value={config.strategy.strategy} />
          <Row
            label="Human escalation"
            value={config.strategy.human_escalation ? "Enabled" : "Disabled"}
          />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Follow-up rules
        </h3>
        <ul className="space-y-1">
          {config.followUps.rules
            .filter((r) => r.enabled)
            .map((r) => (
              <li key={r.trigger} className="text-xs">
                <span className="font-medium">{r.trigger.replaceAll("_", " ")}</span> →{" "}
                {AUTOMATION_ACTION_LABELS[r.action] ?? r.action}
                {r.delay_minutes > 0 ? ` after ${r.delay_minutes} min` : ""}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

function FieldErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="list-inside list-disc rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

// re-export for consumers that want to format outstanding amounts in previews
export { formatMoney };
