/**
 * DEV-ONLY Phase 4 mock backend.
 *
 * Imported exclusively through a dynamic `import()` in `phase4-api.ts` when
 * `NEXT_PUBLIC_USE_MOCKS=true`. Never imported by production code paths, and
 * never used as a silent fallback: without the flag the real endpoints are
 * called. Values here are obviously synthetic demo fixtures — production state
 * always comes from the real control-plane APIs.
 */

import type {
  AIModel,
  AIModelDetail,
  Alert,
  AlertDetail,
  ApiHealthDetail,
  ApiUsageResponse,
  CapacityMetrics,
  ConfigurationItem,
  ConfigurationUpdate,
  DatabaseHealth,
  Deployment,
  DeploymentDetail,
  EnvironmentHealth,
  EventStreamParams,
  Incident,
  IncidentDetail,
  InfraEvent,
  InfraQueue,
  InfraQueueDetail,
  Job,
  JobDetail,
  JobListParams,
  LogEntry,
  LogListParams,
  OperationsSnapshot,
  PerformanceResponse,
  Provider,
  ProviderDetail,
  ProviderMutation,
  RoutingOverview,
  RoutingRule,
  RoutingRuleInput,
  SecurityEvent,
  SecurityEventListParams,
  ServiceDetail,
  ServiceHealth,
  SystemHealth,
  TelephonyInfra,
  UsageQuery,
  UsageResponse,
  VoiceInfra,
  Worker,
  WorkerDetail,
  AuditEntry,
} from "./phase4-types";
import type { Paginated } from "./types";

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const jid = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, "0")}`;

// ---------- System ----------

const SYSTEM_HEALTH: SystemHealth = {
  state: "DEGRADED",
  message: "Worker capacity reduced — one worker is draining.",
  updated_at: iso(0),
  components: [
    { key: "api", label: "API", state: "HEALTHY", message: "All endpoints nominal", latency_ms: 42, last_checked_at: iso(0.2), active_incidents: 0, href: "/infrastructure/services" },
    { key: "database", label: "Database", state: "HEALTHY", message: "Pool 31% utilized", latency_ms: 3, last_checked_at: iso(0.4), active_incidents: 0, href: "/infrastructure/database" },
    { key: "queue", label: "Queue", state: "HEALTHY", message: "Backlog within limits", latency_ms: null, last_checked_at: iso(0.6), active_incidents: 0, href: "/infrastructure/queues" },
    { key: "workers", label: "Workers", state: "DEGRADED", message: "3 workers unavailable", latency_ms: null, last_checked_at: iso(1), active_incidents: 1, href: "/infrastructure/workers" },
    { key: "telephony", label: "Telephony", state: "HEALTHY", message: "All trunks registered", latency_ms: 118, last_checked_at: iso(0.8), active_incidents: 0, href: "/infrastructure/telephony" },
    { key: "ai", label: "AI", state: "HEALTHY", message: "Primary providers healthy", latency_ms: 640, last_checked_at: iso(1.2), active_incidents: 0, href: "/ai/infrastructure" },
    { key: "realtime", label: "Realtime", state: "HEALTHY", message: "Socket connected", latency_ms: 11, last_checked_at: iso(0.1), active_incidents: 0, href: null },
    { key: "storage", label: "Storage", state: "HEALTHY", message: "58% used", latency_ms: null, last_checked_at: iso(5), active_incidents: 0, href: null },
  ],
};

// ---------- Services ----------

const SERVICES: ServiceHealth[] = [
  { id: "svc-api", name: "API", service_type: "API", state: "HEALTHY", version: "1.8.2", region: "ap-south-1", uptime: 0.9998, last_heartbeat_at: iso(0.2), latency_ms: 42, active_jobs: null, error_count: 0, scope: "PLATFORM", message: "All endpoints nominal", updated_at: iso(0.2) },
  { id: "svc-frontend", name: "Frontend", service_type: "FRONTEND", state: "HEALTHY", version: "1.8.2", region: "ap-south-1", uptime: 0.9999, last_heartbeat_at: iso(0.5), latency_ms: 21, active_jobs: null, error_count: 0, scope: "PLATFORM", message: "Serving", updated_at: iso(0.5) },
  { id: "svc-postgres", name: "PostgreSQL", service_type: "DATABASE", state: "HEALTHY", version: "16.3", region: "ap-south-1", uptime: 0.99995, last_heartbeat_at: iso(0.4), latency_ms: 3, active_jobs: null, error_count: 0, scope: "PLATFORM", message: "Pool 31% utilized", updated_at: iso(0.4) },
  { id: "svc-redis", name: "Redis", service_type: "CACHE", state: "HEALTHY", version: "7.2", region: "ap-south-1", uptime: 0.9999, last_heartbeat_at: iso(0.3), latency_ms: 1, active_jobs: null, error_count: 0, scope: "PLATFORM", message: "Memory 42%", updated_at: iso(0.3) },
  { id: "svc-asterisk", name: "Asterisk", service_type: "ASTERISK", state: "HEALTHY", version: "20.5", region: "ap-south-1", uptime: 0.997, last_heartbeat_at: iso(0.8), latency_ms: 118, active_jobs: null, error_count: 2, scope: "PLATFORM", message: "All trunks registered", updated_at: iso(0.8) },
  { id: "svc-ws", name: "WebSocket", service_type: "WEBSOCKET", state: "HEALTHY", version: "1.8.2", region: "ap-south-1", uptime: 0.999, last_heartbeat_at: iso(0.1), latency_ms: 11, active_jobs: null, error_count: 0, scope: "PLATFORM", message: "312 clients connected", updated_at: iso(0.1) },
  { id: "svc-ai-gw", name: "AI Gateway", service_type: "AI_GATEWAY", state: "DEGRADED", version: "1.8.2", region: "ap-south-1", uptime: 0.993, last_heartbeat_at: iso(1.2), latency_ms: 640, active_jobs: 4, error_count: 6, scope: "PLATFORM", message: "STT fallback active", updated_at: iso(1.2) },
  { id: "svc-stt", name: "STT Workers", service_type: "WORKER", state: "HEALTHY", version: "1.8.0", region: "ap-south-1", uptime: 0.998, last_heartbeat_at: iso(0.6), latency_ms: 180, active_jobs: 3, error_count: 0, scope: "PLATFORM", message: null, updated_at: iso(0.6) },
  { id: "svc-tts", name: "TTS Workers", service_type: "WORKER", state: "HEALTHY", version: "1.8.0", region: "ap-south-1", uptime: 0.998, last_heartbeat_at: iso(0.7), latency_ms: 220, active_jobs: 2, error_count: 1, scope: "PLATFORM", message: null, updated_at: iso(0.7) },
  { id: "svc-analysis", name: "Analysis Workers", service_type: "WORKER", state: "DEGRADED", version: "1.8.0", region: "ap-south-1", uptime: 0.981, last_heartbeat_at: iso(3), latency_ms: null, active_jobs: 1, error_count: 9, scope: "PLATFORM", message: "1 worker draining", updated_at: iso(3) },
  { id: "svc-export", name: "Export Workers", service_type: "WORKER", state: "HEALTHY", version: "1.7.9", region: "ap-south-1", uptime: 0.999, last_heartbeat_at: iso(2), latency_ms: 90, active_jobs: 0, error_count: 0, scope: "PLATFORM", message: null, updated_at: iso(2) },
  { id: "svc-followup", name: "Follow-up Workers", service_type: "WORKER", state: "HEALTHY", version: "1.7.9", region: "ap-south-1", uptime: 0.999, last_heartbeat_at: iso(2.5), latency_ms: 75, active_jobs: 5, error_count: 0, scope: "PLATFORM", message: null, updated_at: iso(2.5) },
];

const DEPENDENCIES = {
  "svc-api": ["svc-postgres", "svc-redis", "svc-analysis", "svc-export", "svc-followup"],
  "svc-asterisk": ["svc-redis", "svc-ws"],
  "svc-ai-gw": ["svc-stt", "svc-tts"],
  "svc-ws": ["svc-postgres"],
  "svc-stt": ["svc-redis"],
  "svc-tts": ["svc-redis"],
  "svc-analysis": ["svc-postgres", "svc-redis"],
  "svc-export": ["svc-postgres"],
  "svc-followup": ["svc-postgres", "svc-asterisk"],
} as Record<string, string[]>;

function reverseDeps(id: string): string[] {
  return Object.entries(DEPENDENCIES)
    .filter(([, deps]) => deps.includes(id))
    .map(([from]) => from);
}

function serviceDetail(id: string): ServiceDetail {
  const svc = SERVICES.find((s) => s.id === id);
  if (!svc) throw new Error("SERVICE_NOT_FOUND");
  const deps = DEPENDENCIES[id] ?? [];
  const toEdge = (target: string, reverse = false) => ({
    id: `${id}->${target}`,
    service_id: reverse ? target : id,
    depends_on_id: reverse ? id : target,
    relation: reverse ? "depended on by" : "uses",
  });
  return {
    ...svc,
    dependencies: deps.map((d) => toEdge(d)),
    dependents: reverseDeps(id).map((d) => toEdge(d, true)),
    recent_errors: svc.error_count
      ? [
          { id: `${id}-err-1`, occurred_at: iso(14), code: "TIMEOUT", message: "Upstream timeout after 30s", count: svc.error_count },
          { id: `${id}-err-2`, occurred_at: iso(90), code: "UNAVAILABLE", message: "Dependency unavailable", count: 1 },
        ]
      : [],
    recent_events: recentEventsFor(id, svc.name),
    configuration_summary: [],
    deployment: { id: "dep-0007", version: svc.version, status: "SUCCESS" },
  };
}

// ---------- Workers ----------

const WORKERS: Worker[] = [
  { id: "wrk-001", name: "analysis-worker-1", worker_type: "analysis", status: "HEALTHY", version: "1.8.0", host: "worker-node-01", region: "ap-south-1", concurrency: 4, active_jobs: 3, queued_jobs: 2, failed_jobs: 0, last_heartbeat_at: iso(0.3), started_at: iso(1440), updated_at: iso(0.3), scope: "PLATFORM" },
  { id: "wrk-002", name: "analysis-worker-2", worker_type: "analysis", status: "DRAINING", version: "1.8.0", host: "worker-node-01", region: "ap-south-1", concurrency: 4, active_jobs: 1, queued_jobs: 0, failed_jobs: 2, last_heartbeat_at: iso(0.5), started_at: iso(2880), updated_at: iso(0.5), scope: "PLATFORM" },
  { id: "wrk-003", name: "analysis-worker-3", worker_type: "analysis", status: "FAILED", version: "1.8.0", host: "worker-node-02", region: "ap-south-1", concurrency: 4, active_jobs: 0, queued_jobs: 0, failed_jobs: 14, last_heartbeat_at: iso(47), started_at: iso(2880), updated_at: iso(47), scope: "PLATFORM" },
  { id: "wrk-101", name: "stt-worker-1", worker_type: "stt", status: "HEALTHY", version: "1.8.0", host: "gpu-node-01", region: "ap-south-1", concurrency: 8, active_jobs: 3, queued_jobs: 1, failed_jobs: 0, last_heartbeat_at: iso(0.2), started_at: iso(4320), updated_at: iso(0.2), scope: "PLATFORM" },
  { id: "wrk-102", name: "tts-worker-1", worker_type: "tts", status: "HEALTHY", version: "1.8.0", host: "gpu-node-01", region: "ap-south-1", concurrency: 8, active_jobs: 2, queued_jobs: 0, failed_jobs: 1, last_heartbeat_at: iso(0.2), started_at: iso(4320), updated_at: iso(0.2), scope: "PLATFORM" },
  { id: "wrk-201", name: "export-worker-1", worker_type: "export", status: "HEALTHY", version: "1.7.9", host: "worker-node-03", region: "ap-south-1", concurrency: 2, active_jobs: 0, queued_jobs: 0, failed_jobs: 0, last_heartbeat_at: iso(1), started_at: iso(10080), updated_at: iso(1), scope: "PLATFORM" },
  { id: "wrk-301", name: "follow-up-worker-1", worker_type: "follow_up", status: "HEALTHY", version: "1.7.9", host: "worker-node-03", region: "ap-south-1", concurrency: 4, active_jobs: 5, queued_jobs: 12, failed_jobs: 0, last_heartbeat_at: iso(0.4), started_at: iso(7200), updated_at: iso(0.4), scope: "PLATFORM" },
];

function workerDetail(id: string): WorkerDetail {
  const w = WORKERS.find((x) => x.id === id);
  if (!w) throw new Error("WORKER_NOT_FOUND");
  return {
    ...w,
    current_jobs: Array.from({ length: w.active_jobs ?? 0 }, (_, i) => ({
      id: jid("job", i + 1),
      job_type: `${w.worker_type}.process`,
      queue: `${w.worker_type}_queue`,
      status: "RUNNING",
      started_at: iso(2 + i),
    })),
    recent_jobs: Array.from({ length: 6 }, (_, i) => ({
      id: jid("job", i + 10),
      job_type: `${w.worker_type}.process`,
      queue: `${w.worker_type}_queue`,
      status: i === 3 ? "FAILED" : "COMPLETED",
      started_at: iso(30 + i * 12),
    })),
    throughput: w.status === "HEALTHY" ? 42 : 4,
    failures: w.failed_jobs,
    latency: { avg_ms: 320, p50_ms: 280, p95_ms: 710, p99_ms: 980 },
    retry_count: w.failed_jobs ?? 0,
    heartbeat_history: Array.from({ length: 40 }, (_, i) => ({
      at: iso(40 - i),
      ok: !(w.status === "FAILED" && i > 36),
    })),
    resources: [
      { key: "cpu", label: "CPU", value: 34, max: 100, unit: "%" },
      { key: "memory", label: "Memory", value: 61, max: 100, unit: "%" },
      ...(w.worker_type === "stt" || w.worker_type === "tts"
        ? [{ key: "gpu", label: "GPU", value: 72, max: 100, unit: "%" }]
        : []),
      { key: "queue_depth", label: "Queue depth", value: w.queued_jobs, max: null, unit: "jobs" },
      { key: "active_jobs", label: "Active jobs", value: w.active_jobs, max: w.concurrency, unit: "jobs" },
    ],
  };
}

// ---------- Queues ----------

const QUEUES: InfraQueue[] = [
  { id: "dial_queue", name: "dial_queue", state: "ACTIVE", queue_type: "dial", scope: "PLATFORM", updated_at: iso(0.2), metrics: { pending: 128, running: 12, retry: 6, failed: 3, dead_letter: 0, throughput: 48, oldest_job_at: iso(0.4), worker_count: 4, last_activity_at: iso(0.1) } },
  { id: "analysis_queue", name: "analysis_queue", state: "DEGRADED", queue_type: "analysis", scope: "PLATFORM", updated_at: iso(1), metrics: { pending: 240, running: 4, retry: 18, failed: 26, dead_letter: 4, throughput: 12, oldest_job_at: iso(45), worker_count: 2, last_activity_at: iso(0.5) } },
  { id: "follow_up_queue", name: "follow_up_queue", state: "ACTIVE", queue_type: "follow_up", scope: "PLATFORM", updated_at: iso(0.5), metrics: { pending: 45, running: 5, retry: 2, failed: 1, dead_letter: 0, throughput: 22, oldest_job_at: iso(0.9), worker_count: 2, last_activity_at: iso(0.4) } },
  { id: "export_queue", name: "export_queue", state: "ACTIVE", queue_type: "export", scope: "PLATFORM", updated_at: iso(2), metrics: { pending: 0, running: 0, retry: 0, failed: 0, dead_letter: 0, throughput: 2, oldest_job_at: null, worker_count: 1, last_activity_at: iso(31) } },
  { id: "voice_queue", name: "voice_queue", state: "ACTIVE", queue_type: "voice", scope: "PLATFORM", updated_at: iso(0.3), metrics: { pending: 8, running: 5, retry: 0, failed: 0, dead_letter: 0, throughput: 30, oldest_job_at: iso(0.2), worker_count: 2, last_activity_at: iso(0.2) } },
  { id: "stt_queue", name: "stt_queue", state: "ACTIVE", queue_type: "stt", scope: "PLATFORM", updated_at: iso(0.3), metrics: { pending: 14, running: 3, retry: 1, failed: 0, dead_letter: 0, throughput: 26, oldest_job_at: iso(0.3), worker_count: 1, last_activity_at: iso(0.2) } },
  { id: "tts_queue", name: "tts_queue", state: "ACTIVE", queue_type: "tts", scope: "PLATFORM", updated_at: iso(0.4), metrics: { pending: 4, running: 2, retry: 0, failed: 1, dead_letter: 0, throughput: 18, oldest_job_at: iso(0.4), worker_count: 1, last_activity_at: iso(0.3) } },
];

function queueDetail(id: string): InfraQueueDetail {
  const q = QUEUES.find((x) => x.id === id);
  if (!q) throw new Error("QUEUE_NOT_FOUND");
  return {
    ...q,
    backlog_history: Array.from({ length: 30 }, (_, i) => ({
      at: iso(30 - i),
      value: Math.max(0, (q.metrics.pending ?? 0) + Math.round(Math.sin(i / 4) * 20) + (i > 26 ? 30 : 0)),
    })),
    supported_actions: ["pause", "resume", "retry_failed"],
  };
}

// ---------- Jobs ----------

const JOB_STATUSES = ["FAILED", "RETRYING", "DEAD", "CANCELLED", "RECOVERED"] as const;
const JOB_TYPES = ["analysis.summarize", "export.generate", "follow_up.dispatch", "dial.place"];

function jobsAll(): Job[] {
  return Array.from({ length: 37 }, (_, i) => {
    const status = JOB_STATUSES[i % JOB_STATUSES.length];
    const queue = QUEUES[i % QUEUES.length];
    const retryable = status === "DEAD" ? false : status !== "CANCELLED";
    return {
      id: jid("job", i + 1),
      queue: queue.name,
      job_type: JOB_TYPES[i % JOB_TYPES.length],
      status,
      attempts: 1 + (i % 4),
      max_attempts: 4,
      created_at: iso(60 + i * 7),
      last_attempt_at: iso(5 + i),
      error_code: ["TIMEOUT", "RATE_LIMITED", "UNAVAILABLE", "VALIDATION_ERROR"][i % 4],
      error_message: "Upstream dependency timed out after 30s",
      retryable,
      worker_id: WORKERS[i % WORKERS.length].id,
      worker_name: WORKERS[i % WORKERS.length].name,
      related:
        i % 3 === 0
          ? { kind: "call", id: jid("call", i), label: `Call ${jid("call", i)}`, href: "/live-calls" }
          : i % 3 === 1
            ? { kind: "campaign", id: jid("cmp", i), label: `Campaign ${i + 1}`, href: "/campaigns" }
            : { kind: "account", id: jid("acc", i), label: `Account ${i + 1}`, href: "/accounts" },
    } satisfies Job;
  });
}

function jobDetail(id: string): JobDetail {
  const job = jobsAll().find((x) => x.id === id);
  if (!job) throw new Error("JOB_NOT_FOUND");
  const attempts = job.attempts ?? 1;
  return {
    ...job,
    started_at: iso(8),
    completed_at: null,
    retry_history: Array.from({ length: attempts }, (_, i) => ({
      attempt: i + 1,
      at: iso(30 - i * 8),
      ok: false,
      error_code: job.error_code,
      error_message: job.error_message,
    })),
    metadata: {
      campaign_id: "cmp-0001",
      organization_scope: job.queue === "dial_queue" ? "ORGANIZATION" : "PLATFORM",
      priority: "normal",
    },
    technical_details: "trace_id=4f2a…c19  worker=analysis-worker-1  attempt=2/4  last_error=UpstreamReadTimeout",
  };
}

// ---------- Telephony ----------

const TELEPHONY: TelephonyInfra = {
  gateways: [
    { id: "gw-1", name: "GSM Trunk Mumbai 1", provider_type: "GSM", state: "ONLINE", registration: "REGISTERED", active_calls: 6, capacity: 16, failed_calls: 2, last_heartbeat_at: iso(0.2), scope: "PLATFORM" },
    { id: "gw-2", name: "GSM Trunk Delhi 1", provider_type: "GSM", state: "DEGRADED", registration: "REGISTERED", active_calls: 11, capacity: 16, failed_calls: 14, last_heartbeat_at: iso(0.6), scope: "PLATFORM" },
    { id: "gw-3", name: "SIP Carrier Trunk", provider_type: "SIP", state: "ONLINE", registration: "REGISTERED", active_calls: 4, capacity: 60, failed_calls: 0, last_heartbeat_at: iso(0.3), scope: "PLATFORM" },
    { id: "gw-4", name: "SIP Backup Trunk", provider_type: "SIP", state: "OFFLINE", registration: "UNREGISTERED", active_calls: 0, capacity: 30, failed_calls: 0, last_heartbeat_at: iso(240), scope: "PLATFORM" },
  ],
  active_channels: 21,
  active_calls: 18,
  sip_registrations: 1,
  gsm_online: 1,
  gsm_total: 2,
  setup_latency: { avg_ms: 118, p50_ms: 105, p95_ms: 310, p99_ms: 450 },
  failed_call_rate: 0.031,
  errors: [
    { id: "tel-err-1", occurred_at: iso(9), code: "NO_ANSWER", message: "Trunk Delhi 1: 14 failed calls in the last hour", count: 14 },
    { id: "tel-err-2", occurred_at: iso(240), code: "REGISTRATION_LOST", message: "SIP Backup Trunk lost registration", count: 1 },
  ],
  updated_at: iso(0.2),
};

// ---------- Database / environments / capacity ----------

const DATABASE: DatabaseHealth = {
  connected: true,
  state: "HEALTHY",
  latency: { avg_ms: 3, p50_ms: 2, p95_ms: 9, p99_ms: 18 },
  pool_utilization: 0.31,
  active_connections: 12,
  slow_queries: 2,
  version: "PostgreSQL 16.3",
  migration_status: "Up to date (revision 0042)",
  storage: { used_bytes: 24_100_000_000, total_bytes: 80_000_000_000 },
  updated_at: iso(0.4),
};

const ENVIRONMENTS: EnvironmentHealth[] = [
  {
    id: "env-prod", name: "Production", environment: "production", version: "1.8.2", state: "DEGRADED", updated_at: iso(1),
    components: [
      { key: "api", label: "API", state: "HEALTHY", message: null, latency_ms: 42, last_checked_at: iso(0.3), active_incidents: 0 },
      { key: "database", label: "Database", state: "HEALTHY", message: null, latency_ms: 3, last_checked_at: iso(0.4), active_incidents: 0 },
      { key: "queue", label: "Queue", state: "HEALTHY", message: null, latency_ms: null, last_checked_at: iso(0.5), active_incidents: 0 },
      { key: "workers", label: "Workers", state: "DEGRADED", message: null, latency_ms: null, last_checked_at: iso(1), active_incidents: 1 },
      { key: "telephony", label: "Telephony", state: "HEALTHY", message: null, latency_ms: 118, last_checked_at: iso(0.8), active_incidents: 0 },
      { key: "ai", label: "AI", state: "HEALTHY", message: null, latency_ms: 640, last_checked_at: iso(1.2), active_incidents: 0 },
    ],
  },
  {
    id: "env-staging", name: "Staging", environment: "staging", version: "1.9.0-rc.3", state: "OPERATIONAL", updated_at: iso(2),
    components: [
      { key: "api", label: "API", state: "HEALTHY", message: null, latency_ms: 38, last_checked_at: iso(1), active_incidents: 0 },
      { key: "database", label: "Database", state: "HEALTHY", message: null, latency_ms: 4, last_checked_at: iso(1), active_incidents: 0 },
      { key: "queue", label: "Queue", state: "HEALTHY", message: null, latency_ms: null, last_checked_at: iso(1), active_incidents: 0 },
      { key: "workers", label: "Workers", state: "HEALTHY", message: null, latency_ms: null, last_checked_at: iso(1), active_incidents: 0 },
      { key: "telephony", label: "Telephony", state: "HEALTHY", message: null, latency_ms: 121, last_checked_at: iso(1), active_incidents: 0 },
      { key: "ai", label: "AI", state: "HEALTHY", message: null, latency_ms: 610, last_checked_at: iso(1), active_incidents: 0 },
    ],
  },
];

const CAPACITY: CapacityMetrics = {
  updated_at: iso(0.5),
  metrics: [
    { key: "active_calls", label: "Active calls", value: 18, max: 92, unit: "calls", category: "calls" },
    { key: "call_capacity", label: "Call capacity", value: 92, max: 92, unit: "calls", category: "calls" },
    { key: "queue_depth", label: "Queue depth", value: 439, max: null, unit: "jobs", category: "workers" },
    { key: "workers_active", label: "Active workers", value: 5, max: 7, unit: "workers", category: "workers" },
    { key: "worker_capacity", label: "Worker capacity", value: 34, max: 48, unit: "slots", category: "workers" },
    { key: "ai_requests", label: "AI requests (1h)", value: 8420, max: null, unit: "req", category: "ai" },
    { key: "inference_queue", label: "Inference queue", value: 26, max: null, unit: "jobs", category: "ai" },
    { key: "cpu", label: "CPU", value: 38, max: 100, unit: "%", category: "resources" },
    { key: "memory", label: "Memory", value: 57, max: 100, unit: "%", category: "resources" },
    { key: "gpu", label: "GPU", value: 72, max: 100, unit: "%", category: "resources" },
    { key: "storage", label: "Storage", value: 58, max: 100, unit: "%", category: "resources" },
    { key: "database_load", label: "Database load", value: 31, max: 100, unit: "%", category: "database" },
  ],
};

// ---------- Performance / logs / api usage ----------

function performance(timeframe: string): PerformanceResponse {
  return {
    updated_at: iso(1),
    metrics: [
      { key: "api", label: "API", category: "api", latency: { avg_ms: 42, p50_ms: 36, p95_ms: 110, p99_ms: 180 } },
      { key: "database", label: "Database", category: "database", latency: { avg_ms: 3, p50_ms: 2, p95_ms: 9, p99_ms: 18 } },
      { key: "queue", label: "Queue pickup", category: "queue", latency: { avg_ms: 210, p50_ms: 140, p95_ms: 900, p99_ms: 2400 } },
      { key: "worker", label: "Worker processing", category: "worker", latency: { avg_ms: 320, p50_ms: 280, p95_ms: 710, p99_ms: 980 } },
      { key: "telephony_setup", label: "Telephony setup", category: "telephony", latency: { avg_ms: 118, p50_ms: 105, p95_ms: 310, p99_ms: 450 } },
      { key: "stt", label: "STT", category: "ai", latency: { avg_ms: 180, p50_ms: 160, p95_ms: 420, p99_ms: 610 } },
      { key: "llm", label: "LLM", category: "ai", latency: { avg_ms: 340, p50_ms: 300, p95_ms: 820, p99_ms: 1200 } },
      { key: "tts", label: "TTS", category: "ai", latency: { avg_ms: 220, p50_ms: 200, p95_ms: 480, p99_ms: 700 } },
    ],
    ai_pipeline: [
      { stage: "VAD", latency: { avg_ms: 8, p95_ms: 15 }, errors: 0, queue_wait_ms: 0, processing_ms: 8 },
      { stage: "STT", latency: { avg_ms: 180, p95_ms: 420 }, errors: 2, queue_wait_ms: 25, processing_ms: 155 },
      { stage: "LLM", latency: { avg_ms: 340, p95_ms: 820 }, errors: 1, queue_wait_ms: 40, processing_ms: 300 },
      { stage: "TTS", latency: { avg_ms: 220, p95_ms: 480 }, errors: 1, queue_wait_ms: 18, processing_ms: 202 },
    ],
    ...(timeframe === "7d" ? {} : {}),
  };
}

const LOG_LEVELS = ["INFO", "WARN", "ERROR"] as const;
const LOG_SERVICES = ["api", "worker", "ai-gateway", "telephony", "database"];

function logs(params: LogListParams): Paginated<LogEntry> {
  const all: LogEntry[] = Array.from({ length: 120 }, (_, i) => ({
    id: jid("log", i + 1),
    at: iso(i * 0.5),
    level: LOG_LEVELS[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0],
    service: LOG_SERVICES[i % LOG_SERVICES.length],
    request_id: i % 3 === 0 ? `req-${(i % 40).toString().padStart(3, "0")}` : null,
    job_id: i % 4 === 0 ? jid("job", (i % 37) + 1) : null,
    message:
      LOG_LEVELS[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0] === "ERROR"
        ? "Upstream dependency timed out after 30s"
        : LOG_LEVELS[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0] === "WARN"
          ? "Retry scheduled: backoff 240s"
          : "Request processed",
  })).filter(
    (l) =>
      (!params.level || l.level === params.level) &&
      (!params.service || l.service === params.service) &&
      (!params.request_id || l.request_id === params.request_id) &&
      (!params.job_id || l.job_id === params.job_id) &&
      (!params.search || (l.message ?? "").toLowerCase().includes(params.search.toLowerCase())),
  );
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 25;
  return {
    items: all.slice((page - 1) * pageSize, page * pageSize),
    page,
    page_size: pageSize,
    total: all.length,
  };
}

const API_USAGE: ApiUsageResponse = {
  requests: 128_420,
  ok_2xx: 125_911,
  errors_4xx: 1_902,
  errors_5xx: 607,
  latency: { avg_ms: 42, p50_ms: 36, p95_ms: 110, p99_ms: 180 },
  rate_limited: 34,
  requests_over_time: Array.from({ length: 24 }, (_, i) => ({
    at: iso(23 - i),
    value: 4200 + Math.round(Math.sin(i / 3) * 900) + i * 40,
  })),
  top_endpoints: [
    { endpoint: "GET /api/v1/customers", requests: 41_200, errors: 312, p95_ms: 96 },
    { endpoint: "POST /api/v1/campaigns", requests: 12_400, errors: 88, p95_ms: 130 },
    { endpoint: "GET /api/v1/recovery", requests: 18_900, errors: 210, p95_ms: 105 },
    { endpoint: "POST /api/v1/exports", requests: 3_120, errors: 41, p95_ms: 240 },
    { endpoint: "GET /api/v1/ai/usage", requests: 2_450, errors: 12, p95_ms: 88 },
  ],
  requests_by_service: [
    { label: "api", value: 92_000 },
    { label: "ai-gateway", value: 21_400 },
    { label: "telephony", value: 9_800 },
    { label: "exports", value: 5_220 },
  ],
  updated_at: iso(1),
};

const API_HEALTH: ApiHealthDetail = {
  updated_at: iso(0.5),
  groups: [
    { name: "Authentication", status: "HEALTHY", latency: { avg_ms: 31, p95_ms: 80 }, error_rate: 0.002, last_checked_at: iso(0.4) },
    { name: "Customers", status: "HEALTHY", latency: { avg_ms: 44, p95_ms: 96 }, error_rate: 0.004, last_checked_at: iso(0.4) },
    { name: "Campaigns", status: "HEALTHY", latency: { avg_ms: 52, p95_ms: 120 }, error_rate: 0.006, last_checked_at: iso(0.4) },
    { name: "Recovery", status: "DEGRADED", latency: { avg_ms: 88, p95_ms: 240 }, error_rate: 0.021, last_checked_at: iso(0.4) },
    { name: "AI", status: "HEALTHY", latency: { avg_ms: 74, p95_ms: 180 }, error_rate: 0.009, last_checked_at: iso(0.4) },
    { name: "Telephony", status: "HEALTHY", latency: { avg_ms: 61, p95_ms: 150 }, error_rate: 0.007, last_checked_at: iso(0.4) },
    { name: "Analytics", status: "HEALTHY", latency: { avg_ms: 210, p95_ms: 480 }, error_rate: 0.003, last_checked_at: iso(0.4) },
    { name: "Exports", status: "HEALTHY", latency: { avg_ms: 96, p95_ms: 260 }, error_rate: 0.005, last_checked_at: iso(0.4) },
    { name: "Administration", status: "HEALTHY", latency: { avg_ms: 28, p95_ms: 64 }, error_rate: 0.001, last_checked_at: iso(0.4) },
  ],
};

// ---------- AI providers / models / routing / usage / voice ----------

const PROVIDERS: Provider[] = [
  { id: "prv-openai", name: "OpenAI", provider_type: "LLM", status: "ENABLED", health: "HEALTHY", priority: 1, enabled: true, model_count: 3, requests: 84_200, errors: 412, latency: { avg_ms: 340, p95_ms: 820 }, quota: { used: 8420, limit: 10000, remaining: 1580, utilization: 0.842, reset_at: iso(-420), unit: "requests" }, credential_mask: "sk-****92ab", credential_state: "CONNECTED", last_checked_at: iso(0.4), scope: "PLATFORM" },
  { id: "prv-anthropic", name: "Anthropic", provider_type: "LLM", status: "ENABLED", health: "HEALTHY", priority: 2, enabled: true, model_count: 2, requests: 2_140, errors: 18, latency: { avg_ms: 410, p95_ms: 900 }, quota: null, credential_mask: "sk-ant-****77c1", credential_state: "CONNECTED", last_checked_at: iso(0.6), scope: "PLATFORM" },
  { id: "prv-deepgram", name: "Deepgram", provider_type: "STT", status: "RATE_LIMITED", health: "DEGRADED", priority: 1, enabled: true, model_count: 1, requests: 21_300, errors: 620, latency: { avg_ms: 180, p95_ms: 420 }, quota: { used: 42_800, limit: 45_000, remaining: 2_200, utilization: 0.951, reset_at: iso(-60), unit: "minutes" }, credential_mask: "****3f8d", credential_state: "CONNECTED", last_checked_at: iso(0.5), scope: "PLATFORM" },
  { id: "prv-whisper", name: "Whisper (self-hosted)", provider_type: "STT", status: "ENABLED", health: "HEALTHY", priority: 2, enabled: true, model_count: 1, requests: 3_800, errors: 22, latency: { avg_ms: 240, p95_ms: 510 }, quota: null, credential_mask: null, credential_state: "CONFIGURED", last_checked_at: iso(0.8), scope: "PLATFORM" },
  { id: "prv-elevenlabs", name: "ElevenLabs", provider_type: "TTS", status: "ENABLED", health: "HEALTHY", priority: 1, enabled: true, model_count: 2, requests: 18_900, errors: 87, latency: { avg_ms: 220, p95_ms: 480 }, quota: { used: 5_120, limit: 22_000, remaining: 16_880, utilization: 0.233, reset_at: iso(-1800), unit: "characters" }, credential_mask: "****b2e0", credential_state: "CONNECTED", last_checked_at: iso(0.5), scope: "PLATFORM" },
  { id: "prv-vad", name: "Silero VAD", provider_type: "VAD", status: "ENABLED", health: "HEALTHY", priority: 1, enabled: true, model_count: 1, requests: 240_100, errors: 0, latency: { avg_ms: 8, p95_ms: 15 }, quota: null, credential_mask: null, credential_state: "CONFIGURED", last_checked_at: iso(0.3), scope: "PLATFORM" },
  { id: "prv-legacy", name: "Legacy SMS STT", provider_type: "STT", status: "DISABLED", health: "UNKNOWN", priority: 3, enabled: false, model_count: 0, requests: 0, errors: 0, latency: null, quota: null, credential_mask: "****0000", credential_state: "EXPIRED", last_checked_at: iso(1440), scope: "PLATFORM" },
];

function providerDetail(id: string): ProviderDetail {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error("PROVIDER_NOT_FOUND");
  return {
    ...p,
    models: MODELS.filter((m) => m.provider_id === id),
    error_breakdown: [
      { category: "TIMEOUT", count: 12, last_occurred_at: iso(35), retryable: true, fallback_used: true },
      { category: "RATE_LIMITED", count: p.errors, last_occurred_at: iso(4), retryable: true, fallback_used: true },
      { category: "INVALID_RESPONSE", count: 3, last_occurred_at: iso(400), retryable: false, fallback_used: false },
    ],
    routing_role: p.priority === 1 ? "PRIMARY" : p.enabled ? "FALLBACK" : "NONE",
    audit: [
      { id: "aud-1", at: iso(240), actor: "ops@company.com", action: "provider.updated", resource: p.name, result: "success", detail: "priority 2 → 1" },
      { id: "aud-2", at: iso(2880), actor: "system", action: "provider.health_checked", resource: p.name, result: "success", detail: null },
    ],
  };
}

const MODELS: AIModel[] = [
  { id: "mdl-gpt4o", provider_id: "prv-openai", provider_name: "OpenAI", name: "gpt-4o", model_type: "LLM", enabled: true, availability: "HEALTHY", latency: { avg_ms: 320, p95_ms: 780 }, error_rate: 0.004, usage_count: 51_200, fallback_role: "PRIMARY", routing_priority: 1, context_limit: 128_000, streaming: true, function_calling: true },
  { id: "mdl-gpt4o-mini", provider_id: "prv-openai", provider_name: "OpenAI", name: "gpt-4o-mini", model_type: "LLM", enabled: true, availability: "HEALTHY", latency: { avg_ms: 190, p95_ms: 420 }, error_rate: 0.003, usage_count: 33_000, fallback_role: "FALLBACK", routing_priority: 2, context_limit: 128_000, streaming: true, function_calling: true },
  { id: "mdl-claude", provider_id: "prv-anthropic", provider_name: "Anthropic", name: "claude-sonnet", model_type: "LLM", enabled: true, availability: "HEALTHY", latency: { avg_ms: 410, p95_ms: 900 }, error_rate: 0.006, usage_count: 2_140, fallback_role: "FALLBACK", routing_priority: 3, context_limit: 200_000, streaming: true, function_calling: true },
  { id: "mdl-dg-nova", provider_id: "prv-deepgram", provider_name: "Deepgram", name: "nova-2", model_type: "STT", enabled: true, availability: "DEGRADED", latency: { avg_ms: 180, p95_ms: 420 }, error_rate: 0.029, usage_count: 21_300, fallback_role: "PRIMARY", routing_priority: 1, context_limit: null, streaming: true, function_calling: null },
  { id: "mdl-whisper", provider_id: "prv-whisper", provider_name: "Whisper (self-hosted)", name: "whisper-large-v3", model_type: "STT", enabled: true, availability: "HEALTHY", latency: { avg_ms: 240, p95_ms: 510 }, error_rate: 0.006, usage_count: 3_800, fallback_role: "FALLBACK", routing_priority: 2, context_limit: null, streaming: false, function_calling: null },
  { id: "mdl-el-turbo", provider_id: "prv-elevenlabs", provider_name: "ElevenLabs", name: "eleven-turbo-v2", model_type: "TTS", enabled: true, availability: "HEALTHY", latency: { avg_ms: 220, p95_ms: 480 }, error_rate: 0.005, usage_count: 18_900, fallback_role: "PRIMARY", routing_priority: 1, context_limit: null, streaming: true, function_calling: null },
  { id: "mdl-silero", provider_id: "prv-vad", provider_name: "Silero VAD", name: "silero-vad-v4", model_type: "VAD", enabled: true, availability: "HEALTHY", latency: { avg_ms: 8, p95_ms: 15 }, error_rate: 0, usage_count: 240_100, fallback_role: "PRIMARY", routing_priority: 1, context_limit: null, streaming: null, function_calling: null },
];

function modelDetail(id: string): AIModelDetail {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error("MODEL_NOT_FOUND");
  return {
    ...m,
    configuration: { temperature: 0.4, max_output_tokens: 1024, timeout_ms: 30_000 },
    recent_errors: [
      { id: "me-1", occurred_at: iso(18), code: "RATE_LIMITED", message: "Provider throttling — request routed to fallback", count: 3 },
    ],
    audit: [
      { id: "aud-m-1", at: iso(1440), actor: "ai@company.com", action: "model.updated", resource: m.name, result: "success", detail: "temperature 0.7 → 0.4" },
    ],
  };
}

const ROUTING: RoutingOverview = {
  updated_at: iso(1),
  chain: [
    { position: 1, role: "PRIMARY", provider_id: "prv-openai", provider_name: "OpenAI", model_id: "mdl-gpt4o", model_name: "gpt-4o", fallback_triggers: [], state: "HEALTHY" },
    { position: 2, role: "FALLBACK", provider_id: "prv-openai", provider_name: "OpenAI", model_id: "mdl-gpt4o-mini", model_name: "gpt-4o-mini", fallback_triggers: ["PROVIDER_UNAVAILABLE", "RATE_LIMITED"], state: "HEALTHY" },
    { position: 3, role: "FALLBACK", provider_id: "prv-anthropic", provider_name: "Anthropic", model_id: "mdl-claude", model_name: "claude-sonnet", fallback_triggers: ["PROVIDER_UNAVAILABLE", "QUOTA_EXCEEDED", "TIMEOUT"], state: "HEALTHY" },
  ],
  rules: [
    { id: "rule-1", service_type: "LLM", conditions: ["PROVIDER_UNAVAILABLE", "RATE_LIMITED"], action: "ROUTE_TO_MODEL", target_provider_id: "prv-openai", target_model_id: "mdl-gpt4o-mini", target_label: "OpenAI / gpt-4o-mini", enabled: true, priority: 1, updated_at: iso(240) },
    { id: "rule-2", service_type: "LLM", conditions: ["QUOTA_EXCEEDED", "TIMEOUT"], action: "ROUTE_TO_PROVIDER", target_provider_id: "prv-anthropic", target_model_id: "mdl-claude", target_label: "Anthropic / claude-sonnet", enabled: true, priority: 2, updated_at: iso(1440) },
    { id: "rule-3", service_type: "STT", conditions: ["RATE_LIMITED"], action: "ROUTE_TO_PROVIDER", target_provider_id: "prv-whisper", target_model_id: "mdl-whisper", target_label: "Whisper (self-hosted)", enabled: true, priority: 1, updated_at: iso(2880) },
    { id: "rule-4", service_type: "TTS", conditions: ["TIMEOUT", "HIGH_LATENCY"], action: "FAIL_REQUEST", target_provider_id: null, target_model_id: null, target_label: null, enabled: false, priority: 3, updated_at: iso(4320) },
  ],
};

function usage(_query: UsageQuery): UsageResponse {
  return {
    rows: PROVIDERS.filter((p) => p.enabled).map((p) => ({
      provider_id: p.id,
      provider_name: p.name,
      model_id: null,
      model_name: null,
      service_type: p.provider_type,
      requests: p.requests,
      tokens: p.provider_type === "LLM" ? 41_800_000 : null,
      audio_seconds: p.provider_type === "STT" || p.provider_type === "TTS" ? 480_600 : null,
      success: (p.requests ?? 0) - (p.errors ?? 0),
      errors: p.errors,
      fallback_count: p.id === "prv-deepgram" ? 620 : 34,
      latency: p.latency,
      quota: p.quota,
      rate_limit: p.id === "prv-deepgram" ? { limit: 60, remaining: 0, reset_at: iso(-30) } : null,
    })),
    usage_over_time: Array.from({ length: 24 }, (_, i) => ({
      at: iso(23 - i),
      value: 2600 + Math.round(Math.cos(i / 4) * 700) + i * 30,
    })),
    requests_by_provider: PROVIDERS.filter((p) => p.enabled).map((p) => ({ label: p.name, value: p.requests ?? 0 })),
    fallback_rate: 0.051,
    latency: { avg_ms: 320, p50_ms: 280, p95_ms: 820, p99_ms: 1200 },
  };
}

const VOICE_INFRA: VoiceInfra = {
  tts_services: [
    { id: "voice-el", name: "ElevenLabs Turbo", state: "HEALTHY", latency: { avg_ms: 220, p95_ms: 480 }, usage_count: 18_900, failures: 87, worker_count: 1, scope: "PLATFORM" },
    { id: "voice-preview", name: "Preview synthesis (Phase 2)", state: "HEALTHY", latency: { avg_ms: 610, p95_ms: 990 }, usage_count: 340, failures: 2, worker_count: 1, scope: "ORGANIZATION", organization_id: "org-1" },
  ],
  workers: WORKERS.filter((w) => w.worker_type === "tts"),
  updated_at: iso(0.5),
};

// ---------- Incidents / alerts ----------

const INCIDENTS: Incident[] = [
  { id: "inc-0001", title: "Analysis worker capacity reduced", severity: "SEV3", status: "INVESTIGATING", services: ["workers", "queue"], started_at: iso(38), resolved_at: null, detected_by: "alert: worker.degraded", assigned_to: "ops@company.com", last_update_at: iso(2) },
  { id: "inc-0002", title: "STT provider rate limited", severity: "SEV4", status: "MITIGATED", services: ["ai"], started_at: iso(300), resolved_at: null, detected_by: "alert: provider.rate_limited", assigned_to: "ai@company.com", last_update_at: iso(20) },
  { id: "inc-0003", title: "SIP backup trunk lost registration", severity: "SEV3", status: "RESOLVED", services: ["telephony"], started_at: iso(1500), resolved_at: iso(1420), detected_by: "telephony health probe", assigned_to: "ops@company.com", last_update_at: iso(1420) },
  { id: "inc-0004", title: "Elevated 5xx on recovery endpoints", severity: "SEV2", status: "OPEN", services: ["api", "database"], started_at: iso(9), resolved_at: null, detected_by: "alert: api.error_rate", assigned_to: null, last_update_at: iso(1) },
];

function incidentDetail(id: string): IncidentDetail {
  const inc = INCIDENTS.find((x) => x.id === id);
  if (!inc) throw new Error("INCIDENT_NOT_FOUND");
  return {
    ...inc,
    summary:
      "Worker capacity for the analysis pool dropped after one worker entered draining and one failed. Analysis backlog grew above the backend threshold; dialing continues unaffected.",
    timeline: [
      { at: iso(38), message: "Analysis worker capacity reduced (1 draining, 1 failed)", actor: "system" },
      { at: iso(36), message: "Queue backlog detected on analysis_queue", actor: "system" },
      { at: iso(30), message: "Worker wrk-002 drain requested by ops@company.com", actor: "ops@company.com" },
      { at: iso(12), message: "wrk-003 restarted — booting", actor: "ops@company.com" },
      { at: iso(2), message: "Queue normalized; watching capacity", actor: "system" },
    ],
    metrics: Array.from({ length: 30 }, (_, i) => ({ at: iso(30 - i), value: i > 26 ? 240 : 40 + Math.round(Math.sin(i / 3) * 12) })),
    events: recentEventsFor("workers", "Workers"),
    actions_taken: ["Drained wrk-002", "Restarted wrk-003"],
    resolution: null,
    audit: [
      { id: "aud-i-1", at: iso(30), actor: "ops@company.com", action: "incident.updated", resource: inc.id, result: "success", detail: "status → INVESTIGATING" },
    ],
  };
}

const ALERTS: Alert[] = [
  { id: "alr-1", name: "Queue depth too high", service: "analysis_queue", condition: "pending > 200 for 5m", state: "ACTIVE", started_at: iso(36), last_triggered_at: iso(1), notification_status: "notified", incident_id: "inc-0001" },
  { id: "alr-2", name: "Provider error rate high", service: "Deepgram", condition: "error_rate > 0.05 for 10m", state: "ACTIVE", started_at: iso(300), last_triggered_at: iso(15), notification_status: "notified", incident_id: "inc-0002" },
  { id: "alr-3", name: "Worker unavailable", service: "workers", condition: "healthy_workers < 3 for 5m", state: "ACKNOWLEDGED", started_at: iso(40), last_triggered_at: iso(10), notification_status: "notified", incident_id: "inc-0001" },
  { id: "alr-4", name: "Telephony unavailable", service: "telephony", condition: "gateways_online < 1 for 2m", state: "RESOLVED", started_at: iso(1500), last_triggered_at: iso(1420), notification_status: "notified", incident_id: "inc-0003" },
  { id: "alr-5", name: "Database degraded", service: "database", condition: "latency_p95 > 50ms for 5m", state: "DISABLED", started_at: null, last_triggered_at: iso(10_080), notification_status: null, incident_id: null },
];

function alertDetail(id: string): AlertDetail {
  const a = ALERTS.find((x) => x.id === id);
  if (!a) throw new Error("ALERT_NOT_FOUND");
  return {
    ...a,
    description: "Evaluates every 60s against backend-reported metrics.",
    definition: { metric: "queue.pending", operator: ">", threshold: 200, window_seconds: 300, severity: "SEV3", enabled: a.state !== "DISABLED" },
    triggered_count: 7,
    events: recentEventsFor(a.service ?? "system", a.service ?? "System"),
  };
}

// ---------- Deployments ----------

const DEPLOYMENTS: Deployment[] = [
  { id: "dep-0008", environment: "production", version: "1.8.2", commit: "a1b2c3d", status: "SUCCESS", deployed_at: iso(2_880), deployed_by: "deploy-bot", health: "DEGRADED", migration_status: "Applied (0042)", services: [{ name: "api", version: "1.8.2", status: "HEALTHY" }, { name: "workers", version: "1.8.0", status: "DEGRADED" }] },
  { id: "dep-0007", environment: "production", version: "1.8.1", commit: "9f8e7d6", status: "ROLLED_BACK", deployed_at: iso(10_080), deployed_by: "deploy-bot", health: "HEALTHY", migration_status: "Applied (0041)", services: [{ name: "api", version: "1.8.1", status: "HEALTHY" }] },
  { id: "dep-0006", environment: "staging", version: "1.9.0-rc.3", commit: "b2c3d4e", status: "SUCCESS", deployed_at: iso(1_440), deployed_by: "dev1@company.com", health: "HEALTHY", migration_status: "Applied (0042)", services: [{ name: "api", version: "1.9.0-rc.3", status: "HEALTHY" }] },
  { id: "dep-0005", environment: "staging", version: "1.9.0-rc.2", commit: "c3d4e5f", status: "FAILED", deployed_at: iso(2_880), deployed_by: "dev1@company.com", health: "HEALTHY", migration_status: "Rolled forward", services: [{ name: "api", version: "1.9.0-rc.2", status: "HEALTHY" }] },
];

function deploymentDetail(id: string): DeploymentDetail {
  const d = DEPLOYMENTS.find((x) => x.id === id);
  if (!d) throw new Error("DEPLOYMENT_NOT_FOUND");
  return {
    ...d,
    started_at: new Date((d.deployed_at ? Date.parse(d.deployed_at) : Date.now()) - 4 * 60_000).toISOString(),
    finished_at: d.deployed_at,
    health_checks: [
      { name: "API readiness", ok: true, detail: "200 OK" },
      { name: "Database migration", ok: true, detail: d.migration_status },
      { name: "Worker heartbeat", ok: d.status !== "FAILED", detail: d.status === "FAILED" ? "No heartbeat within 60s" : "All workers reporting" },
    ],
    events: recentEventsFor("deployment", "Deployment"),
    logs_summary: "Build 4m12s · migrate 9s · rollout 2m30s · 0 errors",
    can_redeploy: true,
    can_rollback: d.status === "SUCCESS" && d.environment === "production",
    rollback_target: d.status === "SUCCESS" ? "1.8.1" : null,
  };
}

// ---------- Events / operations ----------

const EVENT_SEEDS: { category: string; service: string; severity: string; event_type: string; message: string }[] = [
  { category: "worker", service: "analysis", severity: "WARNING", event_type: "worker.degraded", message: "analysis-worker-2 draining — capacity reduced" },
  { category: "queue", service: "analysis_queue", severity: "WARNING", event_type: "queue.backlog_changed", message: "analysis_queue backlog 240 (threshold 200)" },
  { category: "ai", service: "deepgram", severity: "WARNING", event_type: "provider.rate_limited", message: "Deepgram throttling STT requests — fallback active" },
  { category: "system", service: "api", severity: "INFO", event_type: "service.health.updated", message: "API latency p95 110ms (within bounds)" },
  { category: "telephony", service: "sip-backup", severity: "ERROR", event_type: "gateway.offline", message: "SIP Backup Trunk lost registration" },
  { category: "recovery", service: "dial_queue", severity: "INFO", event_type: "campaign.dial_completed", message: "Dial batch completed — 48 conversations" },
  { category: "security", service: "api", severity: "INFO", event_type: "security.event", message: "Admin login from 10.20.0.4" },
  { category: "deployment", service: "api", severity: "INFO", event_type: "deployment.completed", message: "1.8.2 deployed to production" },
  { category: "worker", service: "export", severity: "ERROR", event_type: "job.failed", message: "Export job job-0002 failed after 4 attempts" },
  { category: "system", service: "database", severity: "INFO", event_type: "system.health.updated", message: "Database pool 31% utilized" },
];

function recentEventsFor(_service: string, _label: string): InfraEvent[] {
  return EVENT_SEEDS.slice(0, 6).map((s, i) => ({
    id: jid("evt", i + 1),
    at: iso(2 + i * 4),
    category: s.category,
    service: s.service,
    severity: s.severity,
    event_type: s.event_type,
    message: s.message,
    entity: null,
  }));
}

function events(params: EventStreamParams): Paginated<InfraEvent> {
  const all: InfraEvent[] = Array.from({ length: 90 }, (_, i) => {
    const seed = EVENT_SEEDS[i % EVENT_SEEDS.length];
    return {
      id: jid("evt", i + 1),
      at: iso(i * 3),
      category: seed.category,
      service: seed.service,
      severity: seed.severity,
      event_type: seed.event_type,
      message: seed.message,
      entity: null,
    };
  }).filter(
    (e) =>
      (!params.service || e.service === params.service) &&
      (!params.event_type || e.event_type === params.event_type) &&
      (!params.severity || e.severity === params.severity),
  );
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 50;
  return { items: all.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: all.length };
}

const OPERATIONS: OperationsSnapshot = {
  active_calls: 18,
  queued_calls: 128,
  completed_calls: 1_204,
  failed_calls: 39,
  ai_conversations: 16,
  human_transfers: 4,
  pending_analysis: 240,
  pending_follow_ups: 47,
  queue_depth: 439,
  workers_available: 5,
  workers_total: 7,
  telephony_available: 2,
  telephony_total: 4,
  ai_providers_available: 5,
  ai_providers_total: 6,
  recent_events: recentEventsFor("all", "All"),
  updated_at: iso(0.1),
};

// ---------- Configuration ----------

const CONFIGURATION: ConfigurationItem[] = [
  { key: "general.organization_name", category: "General", label: "Organization name", value: "Acme Recovery", is_secret: false, state: "CONFIGURED", description: "Display name used across the console.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: iso(4_320) },
  { key: "realtime.heartbeat_seconds", category: "Realtime", label: "Socket heartbeat interval", value: 25, is_secret: false, state: "CONFIGURED", description: "Keep-alive ping interval for the realtime socket.", requires_restart: true, requires_deployment: false, impact: "Applies to newly connected sockets after restart.", environment: "production", updated_at: iso(10_080) },
  { key: "queue.dial_concurrency", category: "Queue", label: "Dial concurrency", value: 12, is_secret: false, state: "CONFIGURED", description: "Max simultaneous outbound calls per campaign.", requires_restart: false, requires_deployment: false, impact: "Takes effect within one dial cycle.", environment: "production", updated_at: iso(720) },
  { key: "workers.analysis_concurrency", category: "Workers", label: "Analysis worker concurrency", value: 2, is_secret: false, state: "CONFIGURED", description: "Jobs processed in parallel per analysis worker.", requires_restart: true, requires_deployment: false, impact: "Worker restart required; in-flight jobs drain first.", environment: "production", updated_at: iso(1_440) },
  { key: "telephony.asterisk_host", category: "Telephony", label: "Asterisk host", value: "10.20.0.10", is_secret: false, state: "CONFIGURED", description: "PBX endpoint used for call control.", requires_restart: true, requires_deployment: true, impact: "Calls cannot start until the new host registers.", environment: "production", updated_at: iso(20_160) },
  { key: "telephony.asterisk_password", category: "Telephony", label: "Asterisk ARI password", value: null, is_secret: true, state: "CONFIGURED", description: "Stored server-side; never displayed.", requires_restart: true, requires_deployment: false, impact: null, environment: "production", updated_at: iso(43_200) },
  { key: "ai.default_llm", category: "AI", label: "Default LLM model", value: "gpt-4o", is_secret: false, state: "CONFIGURED", description: "Model used when routing has no override.", requires_restart: false, requires_deployment: false, impact: "Applies to new conversations immediately.", environment: "production", updated_at: iso(2_880) },
  { key: "ai.openai_api_key", category: "AI", label: "OpenAI API key", value: null, is_secret: true, state: "CONFIGURED", description: "Stored server-side; never displayed.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: iso(10_080) },
  { key: "ai.deepgram_api_key", category: "AI", label: "Deepgram API key", value: null, is_secret: true, state: "EXPIRED" as never, description: "Stored server-side; never displayed.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: iso(60_000) },
  { key: "exports.retention_days", category: "Exports", label: "Export retention", value: 30, is_secret: false, state: "CONFIGURED", description: "Days before generated files are deleted.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: iso(720) },
  { key: "security.session_ttl_minutes", category: "Security", label: "Session TTL", value: 720, is_secret: false, state: "CONFIGURED", description: "Access-token lifetime in minutes.", requires_restart: true, requires_deployment: false, impact: "Active sessions keep their token until expiry.", environment: "production", updated_at: iso(720) },
  { key: "retention.audit_days", category: "Retention", label: "Audit retention", value: 365, is_secret: false, state: "INHERITED", description: "Platform default inherited by this organization.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: null },
  { key: "security.sso_cert", category: "Security", label: "SSO signing certificate", value: null, is_secret: false, state: "MANAGED_EXTERNALLY", description: "Managed by the identity provider.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: null },
  { key: "ai.tts_fallback_voice", category: "AI", label: "TTS fallback voice", value: null, is_secret: false, state: "NOT_CONFIGURED", description: "Voice used when the primary profile fails.", requires_restart: false, requires_deployment: false, impact: null, environment: "production", updated_at: null },
];

// ---------- Security / audit ----------

const SECURITY_EVENTS: SecurityEvent[] = [
  { id: "sec-1", at: iso(4), actor: "ops@company.com", organization_id: "org-1", action: "worker.control", resource: "wrk-002", result: "success", ip: "10.20.0.4", user_agent: "Chrome/130", severity: "MEDIUM" },
  { id: "sec-2", at: iso(26), actor: "unknown", organization_id: null, action: "auth.login_failed", resource: "/api/v1/auth/login", result: "denied", ip: "203.0.113.7", user_agent: "curl/8.4", severity: "HIGH" },
  { id: "sec-3", at: iso(90), actor: "ai@company.com", organization_id: "org-1", action: "provider.configuration_changed", resource: "prv-openai", result: "success", ip: "10.20.0.9", user_agent: "Chrome/130", severity: "MEDIUM" },
  { id: "sec-4", at: iso(220), actor: "ops@company.com", organization_id: "org-1", action: "export.generated", resource: "exp-0009", result: "success", ip: "10.20.0.4", user_agent: "Chrome/130", severity: "INFO" },
  { id: "sec-5", at: iso(400), actor: "agent@company.com", organization_id: "org-2", action: "permission.denied", resource: "/api/v1/configuration", result: "denied", ip: "10.20.1.12", user_agent: "Firefox/132", severity: "MEDIUM" },
  { id: "sec-6", at: iso(1_440), actor: "ops@company.com", organization_id: "org-1", action: "admin.login", resource: "/login", result: "success", ip: "10.20.0.4", user_agent: "Chrome/130", severity: "INFO" },
];

function securityEvents(params: SecurityEventListParams): Paginated<SecurityEvent> {
  const all = SECURITY_EVENTS.filter(
    (e) =>
      (!params.severity || e.severity === params.severity) &&
      (!params.action || e.action === params.action) &&
      (!params.search ||
        (e.actor ?? "").toLowerCase().includes(params.search.toLowerCase()) ||
        (e.action ?? "").toLowerCase().includes(params.search.toLowerCase())),
  );
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 25;
  return { items: all.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: all.length };
}

const AUDIT: AuditEntry[] = [
  { id: "aud-1", at: iso(4), actor: "ops@company.com", action: "worker.drain", resource: "wrk-002", result: "success", detail: "Drain requested from worker detail" },
  { id: "aud-2", at: iso(30), actor: "ops@company.com", action: "incident.updated", resource: "inc-0001", result: "success", detail: "status → INVESTIGATING" },
  { id: "aud-3", at: iso(90), actor: "ai@company.com", action: "routing.updated", resource: "rule-1", result: "success", detail: "conditions +RATE_LIMITED" },
  { id: "aud-4", at: iso(220), actor: "supervisor@company.com", action: "export.created", resource: "exp-0009", result: "success", detail: null },
  { id: "aud-5", at: iso(400), actor: "agent@company.com", action: "configuration.read_denied", resource: "security.sso_cert", result: "denied", detail: null },
];

// ---------- Mock entry points ----------

export const phase4Mock = {
  getSystemHealth: async () => SYSTEM_HEALTH,
  listServices: async () => SERVICES,
  getService: async (id: string) => serviceDetail(id),
  listWorkers: async () => WORKERS,
  getWorker: async (id: string) => workerDetail(id),
  workerAction: async (id: string, action: string) => {
    const w = WORKERS.find((x) => x.id === id);
    if (w) {
      if (action === "drain") w.status = "DRAINING";
      if (action === "resume" || action === "restart") w.status = "HEALTHY";
      if (action === "disable") w.status = "STOPPED";
      w.updated_at = new Date().toISOString();
    }
    return workerDetail(id);
  },
  listQueues: async () => QUEUES,
  getQueue: async (id: string) => queueDetail(id),
  queueAction: async (id: string, action: string) => {
    const q = QUEUES.find((x) => x.id === id);
    if (q) {
      if (action === "pause") q.state = "PAUSED";
      if (action === "resume") q.state = "ACTIVE";
      if (action === "retry_failed" && q.metrics) q.metrics.failed = 0;
      q.updated_at = new Date().toISOString();
    }
    return queueDetail(id);
  },
  listJobs: async (params: JobListParams) => {
    const all = jobsAll().filter(
      (j) =>
        (!params.queue || j.queue === params.queue) &&
        (!params.status || j.status === params.status) &&
        (!params.search ||
          (j.job_type ?? "").toLowerCase().includes(params.search.toLowerCase()) ||
          (j.error_code ?? "").toLowerCase().includes(params.search.toLowerCase())),
    );
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 25;
    return { items: all.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: all.length };
  },
  getJob: async (id: string) => jobDetail(id),
  jobAction: async (id: string, action: string) => {
    const detail = jobDetail(id);
    if (action === "retry") detail.status = "RETRYING";
    if (action === "cancel") detail.status = "CANCELLED";
    return detail;
  },
  getTelephonyInfra: async () => TELEPHONY,
  getDatabaseHealth: async () => DATABASE,
  listEnvironments: async () => ENVIRONMENTS,
  getCapacity: async () => CAPACITY,
  getPerformance: async (timeframe: string) => performance(timeframe),
  listLogs: async (params: LogListParams) => logs(params),
  getApiUsage: async () => API_USAGE,
  getApiHealth: async () => API_HEALTH,
  getAIInfrastructure: async () => ({ overview: true }),
  listProviders: async () => PROVIDERS,
  getProvider: async (id: string) => providerDetail(id),
  updateProvider: async (id: string, patch: ProviderMutation) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (p) {
      if (patch.enabled !== undefined) {
        p.enabled = patch.enabled;
        p.status = patch.enabled ? "ENABLED" : "DISABLED";
      }
      if (patch.priority !== undefined) p.priority = patch.priority;
    }
    return providerDetail(id);
  },
  testProvider: async (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (p) p.last_checked_at = new Date().toISOString();
    return providerDetail(id);
  },
  listModels: async () => MODELS,
  getModel: async (id: string) => modelDetail(id),
  getRouting: async () => ROUTING,
  createRoutingRule: async (input: RoutingRuleInput) => {
    const rule: RoutingRule = {
      id: jid("rule", ROUTING.rules.length + 1),
      service_type: input.service_type,
      conditions: [...input.conditions],
      action: input.action,
      target_provider_id: input.target_provider_id ?? null,
      target_model_id: input.target_model_id ?? null,
      target_label: input.target_model_id ?? input.target_provider_id ?? null,
      enabled: input.enabled ?? true,
      priority: input.priority ?? ROUTING.rules.length + 1,
      updated_at: new Date().toISOString(),
    };
    ROUTING.rules.push(rule);
    return rule;
  },
  updateRoutingRule: async (id: string, patch: Partial<RoutingRuleInput>) => {
    const rule = ROUTING.rules.find((r: RoutingRule) => r.id === id);
    if (rule) Object.assign(rule, patch, { updated_at: new Date().toISOString() });
    return rule as RoutingRule;
  },
  deleteRoutingRule: async (id: string) => {
    const idx = ROUTING.rules.findIndex((r: RoutingRule) => r.id === id);
    if (idx >= 0) ROUTING.rules.splice(idx, 1);
  },
  getUsage: async (query: UsageQuery) => usage(query),
  getVoiceInfra: async () => VOICE_INFRA,
  listIncidents: async () => INCIDENTS,
  getIncident: async (id: string) => incidentDetail(id),
  updateIncident: async (id: string, patch: Record<string, unknown>) => {
    const inc = INCIDENTS.find((x) => x.id === id);
    if (inc) Object.assign(inc, patch);
    return incidentDetail(id);
  },
  listAlerts: async () => ALERTS,
  getAlert: async (id: string) => alertDetail(id),
  alertAction: async (id: string, action: string) => {
    const a = ALERTS.find((x) => x.id === id);
    if (a) {
      if (action === "acknowledge") a.state = "ACKNOWLEDGED";
      if (action === "resolve") a.state = "RESOLVED";
      if (action === "disable") a.state = "DISABLED";
    }
    return alertDetail(id);
  },
  listDeployments: async () => DEPLOYMENTS,
  getDeployment: async (id: string) => deploymentDetail(id),
  listEvents: async (params: EventStreamParams) => events(params),
  getOperations: async () => OPERATIONS,
  listConfiguration: async () => CONFIGURATION,
  updateConfiguration: async (key: string, patch: ConfigurationUpdate) => {
    const item = CONFIGURATION.find((c) => c.key === key);
    if (item) {
      item.value = patch.value;
      item.state = "CONFIGURED";
      item.updated_at = new Date().toISOString();
    }
    if (!item) throw new Error("CONFIG_NOT_FOUND");
    return item;
  },
  listSecurityEvents: async (params: SecurityEventListParams) => securityEvents(params),
  listAudit: async (params: Record<string, unknown>) => {
    const page = Number(params.page ?? 1);
    const pageSize = Number(params.page_size ?? 25);
    return { items: AUDIT.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: AUDIT.length };
  },
};

export default phase4Mock;
