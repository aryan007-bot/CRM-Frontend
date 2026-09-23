/**
 * Phase 4 types — operational control plane.
 *
 * Mirrors the expected FastAPI/Pydantic schemas for infrastructure domains.
 * Same wire conventions as Phase 1–3: ISO-8601 timestamps, decimal strings for
 * money, `{ data: ... }` envelopes handled by the API client.
 *
 * Every field is either what the backend actually returns or explicitly
 * optional — the UI renders only what arrives and never invents metrics.
 */

// ---------- Shared primitives ----------

/** Overall roll-up state. The backend computes it; the UI never derives it. */
export type SystemState = "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "CRITICAL" | "UNKNOWN";

/** Per-service / component health. */
export type HealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "OFFLINE"
  | "STARTING"
  | "DRAINING"
  | "STOPPED"
  | "FAILED"
  | "UNKNOWN";

/** Platform-global vs organization-scoped infrastructure (spec §68). */
export type Scope = "PLATFORM" | "ORGANIZATION";

export interface ScopeAware {
  scope: Scope;
  /** Present when `scope` is ORGANIZATION. */
  organization_id?: string | null;
}

/** A single latency observation (average plus percentiles when supplied). */
export interface LatencyStats {
  avg_ms?: number | null;
  p50_ms?: number | null;
  p95_ms?: number | null;
  p99_ms?: number | null;
}

// ---------- 1. System overview ----------

export interface ComponentHealth {
  /** Canonical component key: api, database, queue, workers, telephony, ai, realtime, storage. */
  key: string;
  label: string;
  state: HealthState;
  /** Backend-computed roll-up of the whole system. */
  message: string | null;
  latency_ms: number | null;
  last_checked_at: string | null;
  active_incidents: number;
  /** Components the UI should deep-link into, when present. */
  href?: string | null;
}

export interface SystemHealth {
  state: SystemState;
  message: string | null;
  components: ComponentHealth[];
  updated_at: string | null;
}

// ---------- 2. Services ----------

export type ServiceType =
  | "API"
  | "FRONTEND"
  | "DATABASE"
  | "CACHE"
  | "ASTERISK"
  | "SIP_GATEWAY"
  | "WEBSOCKET"
  | "AI_GATEWAY"
  | "WORKER"
  | "STORAGE"
  | "OTHER";

export interface ServiceHealth {
  id: string;
  name: string;
  service_type: ServiceType | string;
  state: HealthState;
  version: string | null;
  region: string | null;
  /** Uptime fraction 0..1 — the backend computes it from heartbeats. */
  uptime: number | null;
  last_heartbeat_at: string | null;
  latency_ms: number | null;
  active_jobs: number | null;
  error_count: number | null;
  scope: Scope;
  message: string | null;
  updated_at: string | null;
}

/** Directed dependency edge (service -> depends on). Backend relationship data. */
export interface ServiceDependency {
  id: string;
  service_id: string;
  depends_on_id: string;
  /** Copy for the edge, e.g. "uses" — optional. */
  relation?: string | null;
}

export interface ServiceDetail extends ServiceHealth {
  dependencies: ServiceDependency[];
  /** Services that depend on this one (reverse edges). */
  dependents: ServiceDependency[];
  recent_errors: ServiceErrorItem[];
  recent_events: InfraEvent[];
  configuration_summary: ConfigurationItem[];
  deployment: DeploymentRef | null;
}

export interface ServiceErrorItem {
  id: string;
  occurred_at: string;
  code: string | null;
  message: string | null;
  count: number | null;
}

// ---------- 3. Workers ----------

export type WorkerStatus =
  | "STARTING"
  | "HEALTHY"
  | "DEGRADED"
  | "DRAINING"
  | "STOPPED"
  | "FAILED"
  | "UNKNOWN";

export interface WorkerJobSummary {
  id: string;
  job_type: string | null;
  queue: string | null;
  status: string | null;
  started_at: string | null;
}

export interface Worker {
  id: string;
  name: string;
  worker_type: string;
  status: WorkerStatus;
  version: string | null;
  host: string | null;
  region: string | null;
  concurrency: number | null;
  active_jobs: number | null;
  queued_jobs: number | null;
  failed_jobs: number | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  updated_at: string | null;
  scope: Scope;
}

export interface ResourceMetric {
  /** cpu | memory | gpu | queue_depth | active_jobs … */
  key: string;
  label: string;
  value: number | null;
  /** Upper bound when the backend supplies one; percent derives from it. */
  max: number | null;
  unit: string | null;
}

export interface WorkerDetail extends Worker {
  current_jobs: WorkerJobSummary[];
  recent_jobs: WorkerJobSummary[];
  /** Backend-reported rolling counts for the selected window. */
  throughput: number | null;
  failures: number | null;
  latency: LatencyStats | null;
  retry_count: number | null;
  heartbeat_history: HeartbeatPoint[];
  resources: ResourceMetric[];
}

export interface HeartbeatPoint {
  at: string;
  /** 1 = alive, 0 = missed. */
  ok: boolean;
}

// ---------- 4. Queues ----------

export type QueueState = "ACTIVE" | "PAUSED" | "DEGRADED" | "UNKNOWN";

export interface QueueMetrics {
  pending: number | null;
  running: number | null;
  retry: number | null;
  failed: number | null;
  dead_letter: number | null;
  /** Jobs per minute (or the backend unit) when supplied. */
  throughput: number | null;
  oldest_job_at: string | null;
  worker_count: number | null;
  last_activity_at: string | null;
}

export interface InfraQueue {
  id: string;
  name: string;
  state: QueueState;
  /** e.g. dial_queue, analysis_queue — informational. */
  queue_type: string | null;
  metrics: QueueMetrics;
  scope: Scope;
  updated_at: string | null;
}

export interface InfraQueueDetail extends InfraQueue {
  backlog_history: TimePoint[];
  supported_actions: QueueAction[];
}

export type QueueAction = "pause" | "resume" | "retry_failed";

export interface TimePoint {
  at: string;
  value: number | null;
}

// ---------- 5. Jobs ----------

export type JobStatus = "FAILED" | "RETRYING" | "DEAD" | "CANCELLED" | "RECOVERED";

export interface Job {
  id: string;
  queue: string | null;
  job_type: string | null;
  status: JobStatus | string;
  attempts: number | null;
  max_attempts: number | null;
  created_at: string | null;
  last_attempt_at: string | null;
  error_code: string | null;
  /** User-safe summary; raw stack traces never reach the client. */
  error_message: string | null;
  retryable: boolean | null;
  worker_id: string | null;
  worker_name: string | null;
  /** Typed reference for cross-links, e.g. {kind: "campaign", id, label}. */
  related: RelatedEntity | null;
}

export interface RelatedEntity {
  kind: string;
  id: string;
  label: string | null;
  /** Where the UI should link, when the backend provides one. */
  href?: string | null;
}

export interface JobDetail extends Job {
  started_at: string | null;
  completed_at: string | null;
  retry_history: JobAttempt[];
  /** Redacted metadata; secrets are stripped server-side. */
  metadata: Record<string, string | number | boolean | null> | null;
  /** Technical details section — admin-only capability gates visibility. */
  technical_details: string | null;
}

export interface JobAttempt {
  attempt: number;
  at: string | null;
  ok: boolean;
  error_code: string | null;
  error_message: string | null;
}

export interface JobListParams {
  queue?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ---------- 6. Telephony infrastructure ----------

export type GatewayState = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export interface TelephonyGatewayInfra {
  id: string;
  name: string;
  provider_type: string | null;
  state: GatewayState;
  registration: string | null;
  active_calls: number | null;
  /** Backend-provided capacity; the UI never hardcodes limits. */
  capacity: number | null;
  failed_calls: number | null;
  last_heartbeat_at: string | null;
  scope: Scope;
}

export interface TelephonyInfra {
  gateways: TelephonyGatewayInfra[];
  active_channels: number | null;
  active_calls: number | null;
  sip_registrations: number | null;
  gsm_online: number | null;
  gsm_total: number | null;
  /** Call setup latency stats when the backend computes them. */
  setup_latency: LatencyStats | null;
  failed_call_rate: number | null;
  errors: ServiceErrorItem[];
  updated_at: string | null;
}

// ---------- 7. AI infrastructure & providers ----------

export type ProviderKind = "LLM" | "STT" | "TTS" | "VAD" | "EMBEDDING";

export type ProviderStatus =
  | "ENABLED"
  | "DISABLED"
  | "UNHEALTHY"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "UNKNOWN";

export type CredentialState =
  | "CONFIGURED"
  | "CONNECTED"
  | "INVALID"
  | "EXPIRED"
  | "NOT_CONFIGURED";

export interface Provider {
  id: string;
  name: string;
  provider_type: ProviderKind | string;
  status: ProviderStatus | string;
  /** Human-readable health, never a secret value. */
  health: HealthState;
  priority: number | null;
  enabled: boolean;
  model_count: number | null;
  requests: number | null;
  errors: number | null;
  latency: LatencyStats | null;
  quota: QuotaUsage | null;
  /** e.g. "sk-****92ab" — masked server-side; the client renders it verbatim. */
  credential_mask: string | null;
  credential_state: CredentialState | string | null;
  last_checked_at: string | null;
  scope: Scope;
}

export interface ProviderDetail extends Provider {
  models: AIModel[];
  error_breakdown: ProviderErrorStat[];
  routing_role: RoutingRole | null;
  audit: AuditEntry[];
}

export interface ProviderErrorStat {
  /** TIMEOUT | RATE_LIMITED | QUOTA_EXCEEDED | UNAVAILABLE | INVALID_RESPONSE | VALIDATION_ERROR | CONFIGURATION_ERROR */
  category: string;
  count: number | null;
  last_occurred_at: string | null;
  retryable: boolean | null;
  fallback_used: boolean | null;
}

export interface ProviderMutation {
  enabled?: boolean;
  /** Backend-defined metadata fields; never credentials. */
  display_name?: string;
  priority?: number;
}

// ---------- 8. Models ----------

export type RoutingRole = "PRIMARY" | "FALLBACK" | "NONE";

export interface AIModel {
  id: string;
  provider_id: string;
  provider_name: string | null;
  name: string;
  model_type: ProviderKind | string;
  enabled: boolean;
  availability: HealthState;
  latency: LatencyStats | null;
  error_rate: number | null;
  usage_count: number | null;
  fallback_role: RoutingRole | string | null;
  routing_priority: number | null;
  /** Capability flags — only present when the backend supplies them. */
  context_limit: number | null;
  streaming: boolean | null;
  function_calling: boolean | null;
}

export interface AIModelDetail extends AIModel {
  configuration: Record<string, string | number | boolean | null> | null;
  recent_errors: ServiceErrorItem[];
  audit: AuditEntry[];
}

// ---------- 9. Routing ----------

export type RoutingCondition =
  | "PROVIDER_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "HIGH_LATENCY"
  | "MODEL_UNAVAILABLE";

export type RoutingActionType = "ROUTE_TO_PROVIDER" | "ROUTE_TO_MODEL" | "FAIL_REQUEST";

export interface RoutingRule {
  id: string;
  /** Service the rule applies to, e.g. LLM / STT / TTS. */
  service_type: ProviderKind | string;
  /** Typed condition list — no arbitrary expressions. */
  conditions: RoutingCondition[];
  action: RoutingActionType;
  /** Provider/model to route to when `action` routes somewhere. */
  target_provider_id: string | null;
  target_model_id: string | null;
  target_label: string | null;
  enabled: boolean;
  priority: number | null;
  updated_at: string | null;
}

export interface RoutingRuleInput {
  service_type: ProviderKind | string;
  conditions: RoutingCondition[];
  action: RoutingActionType;
  target_provider_id?: string | null;
  target_model_id?: string | null;
  enabled?: boolean;
  priority?: number | null;
}

export interface RoutingOverview {
  /** Ordered fallback chain: primary first, then fallbacks. */
  chain: RoutingChainStep[];
  rules: RoutingRule[];
  updated_at: string | null;
}

export interface RoutingChainStep {
  position: number;
  role: RoutingRole;
  provider_id: string | null;
  provider_name: string | null;
  model_id: string | null;
  model_name: string | null;
  /** Why the next step would be used — backend-declared. */
  fallback_triggers: RoutingCondition[];
  state: HealthState;
}

// ---------- 10. Usage & quota ----------

export interface QuotaUsage {
  used: number | null;
  limit: number | null;
  /** Remaining derived server-side when provided; UI may compute for display. */
  remaining: number | null;
  utilization: number | null;
  reset_at: string | null;
  unit: string | null;
}

export interface UsageRow {
  provider_id: string;
  provider_name: string | null;
  model_id: string | null;
  model_name: string | null;
  service_type: ProviderKind | string;
  requests: number | null;
  tokens: number | null;
  /** Audio minutes when the backend tracks them (STT/TTS). */
  audio_seconds: number | null;
  success: number | null;
  errors: number | null;
  fallback_count: number | null;
  latency: LatencyStats | null;
  quota: QuotaUsage | null;
  rate_limit: RateLimitInfo | null;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset_at: string | null;
}

export interface UsageResponse {
  rows: UsageRow[];
  /** Optional aggregates for charts — each may be absent. */
  usage_over_time: TimePoint[] | null;
  requests_by_provider: { label: string; value: number }[] | null;
  fallback_rate: number | null;
  latency: LatencyStats | null;
}

export interface UsageQuery {
  date_from?: string;
  date_to?: string;
  provider_id?: string;
}

/** Cost rows — only rendered when the backend supplies cost data. */
export interface CostRow {
  provider_id: string;
  provider_name: string | null;
  model_name: string | null;
  date: string;
  request_count: number | null;
  estimated_cost: string | null;
  actual_cost: string | null;
  currency: string | null;
}

// ---------- 11. Voice services (Phase 4 view over Phase 2 voice) ----------

export interface VoiceServiceHealth {
  id: string;
  name: string;
  state: HealthState;
  latency: LatencyStats | null;
  usage_count: number | null;
  failures: number | null;
  worker_count: number | null;
  scope: Scope;
  organization_id?: string | null;
}

export interface VoiceInfra {
  tts_services: VoiceServiceHealth[];
  workers: Worker[];
  updated_at: string | null;
}

// ---------- 12. Incidents & alerts ----------

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED" | "CLOSED";

export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4" | "UNKNOWN";

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity | string;
  status: IncidentStatus | string;
  /** Service keys affected, e.g. ["api", "workers"]. */
  services: string[];
  started_at: string;
  resolved_at: string | null;
  detected_by: string | null;
  assigned_to: string | null;
  last_update_at: string | null;
}

export interface IncidentDetail extends Incident {
  summary: string | null;
  timeline: IncidentTimelineEntry[];
  metrics: TimePoint[] | null;
  events: InfraEvent[];
  actions_taken: string[] | null;
  resolution: string | null;
  audit: AuditEntry[];
}

export interface IncidentTimelineEntry {
  at: string;
  message: string;
  actor: string | null;
}

export interface IncidentUpdate {
  status?: IncidentStatus;
  assigned_to?: string | null;
  note?: string | null;
}

export type AlertState = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISABLED";

export interface Alert {
  id: string;
  name: string;
  service: string | null;
  /** Backend-defined condition description, e.g. "queue depth > 500 for 5m". */
  condition: string | null;
  state: AlertState | string;
  started_at: string | null;
  last_triggered_at: string | null;
  /** Backend notification status, e.g. notified/failed/pending. */
  notification_status: string | null;
  incident_id: string | null;
}

export interface AlertDetail extends Alert {
  description: string | null;
  /** Typed definition when the backend exposes it (spec §28). */
  definition: AlertDefinition | null;
  triggered_count: number | null;
  events: InfraEvent[];
}

export interface AlertDefinition {
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | string;
  threshold: number;
  /** Window in seconds. */
  window_seconds: number | null;
  severity: IncidentSeverity | string;
  enabled: boolean;
}

// ---------- 13. Deployments & environments ----------

export type DeploymentStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "ROLLED_BACK";

export interface DeploymentRef {
  id: string;
  version: string | null;
  status: DeploymentStatus | string;
}

export interface Deployment {
  id: string;
  environment: string;
  version: string | null;
  commit: string | null;
  status: DeploymentStatus | string;
  deployed_at: string | null;
  deployed_by: string | null;
  health: HealthState;
  migration_status: string | null;
  services: DeploymentService[];
}

export interface DeploymentService {
  name: string;
  version: string | null;
  status: HealthState | string;
}

export interface DeploymentDetail extends Deployment {
  started_at: string | null;
  finished_at: string | null;
  health_checks: { name: string; ok: boolean; detail: string | null }[];
  events: InfraEvent[];
  logs_summary: string | null;
  /** Backend-declared availability; UI renders actions only when true. */
  can_redeploy: boolean;
  can_rollback: boolean;
  rollback_target: string | null;
}

export interface EnvironmentHealth {
  id: string;
  name: string;
  /** development | staging | production */
  environment: string;
  version: string | null;
  components: ComponentHealth[];
  state: SystemState;
  updated_at: string | null;
}

// ---------- 14. Configuration ----------

export type ConfigurationState =
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "INVALID"
  | "INHERITED"
  | "MANAGED_EXTERNALLY";

export interface ConfigurationItem {
  key: string;
  category: string;
  label: string;
  /** Present only for non-secret values; secrets arrive as null + is_secret. */
  value: string | number | boolean | null;
  is_secret: boolean;
  state: ConfigurationState | string;
  description: string | null;
  requires_restart: boolean;
  requires_deployment: boolean;
  /** Backend-computed impact text for production changes. */
  impact: string | null;
  /** Environment the value applies to when the backend distinguishes. */
  environment: string | null;
  updated_at: string | null;
}

export interface ConfigurationUpdate {
  value: string | number | boolean;
}

/** Field-level diff entry for the confirmation flow (spec §48). */
export interface ConfigurationDiffEntry {
  key: string;
  label: string;
  current: string | number | boolean | null;
  proposed: string | number | boolean | null;
  requires_restart: boolean;
  requires_deployment: boolean;
  impact: string | null;
}

// ---------- 15. Security & audit ----------

export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityEvent {
  id: string;
  at: string;
  actor: string | null;
  organization_id: string | null;
  action: string;
  resource: string | null;
  /** success | denied | failure — backend-defined result. */
  result: string | null;
  ip: string | null;
  user_agent: string | null;
  severity: SecuritySeverity | string;
}

export interface SecurityEventListParams {
  severity?: string;
  action?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  resource: string | null;
  result: string | null;
  detail: string | null;
}

export interface AuditListParams {
  actor?: string;
  action?: string;
  resource?: string;
  service?: string;
  result?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ---------- 16. Events stream & realtime ----------

export type EventSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

/**
 * Server-persisted infrastructure event (the /operations/events feed).
 * Realtime WS events reuse `WebSocketEvent` from Phase 2 types.
 */
export interface InfraEvent {
  id: string;
  at: string;
  /** system | worker | queue | ai | telephony | campaign | recovery | deployment | security */
  category: string;
  service: string | null;
  severity: EventSeverity | string;
  event_type: string;
  message: string | null;
  entity: RelatedEntity | null;
}

export interface EventStreamParams {
  service?: string;
  event_type?: string;
  severity?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

/** Client-side dedupe record for realtime events (spec §73). */
export interface RealtimeEvent {
  id: string;
  at: string;
  category: string;
  severity: EventSeverity | string;
  event_type: string;
  message: string | null;
  entity: RelatedEntity | null;
}

// ---------- 17. Capacity, performance, logs, api usage ----------

export interface CapacityMetric {
  key: string;
  label: string;
  value: number | null;
  /** Capacity upper bound when the backend supplies one. */
  max: number | null;
  unit: string | null;
  category: "calls" | "workers" | "ai" | "resources" | "database";
}

export interface CapacityMetrics {
  metrics: CapacityMetric[];
  updated_at: string | null;
}

export interface PerformanceMetric {
  key: string;
  label: string;
  latency: LatencyStats;
  category: "api" | "database" | "queue" | "worker" | "telephony" | "ai";
}

export interface PerformanceResponse {
  metrics: PerformanceMetric[];
  /** AI pipeline stage breakdown (spec §38) — present when measured. */
  ai_pipeline: AIStageLatency[] | null;
  updated_at: string | null;
}

export interface AIStageLatency {
  stage: "VAD" | "STT" | "LLM" | "TTS" | string;
  latency: LatencyStats;
  errors: number | null;
  queue_wait_ms: number | null;
  processing_ms: number | null;
}

export interface LogEntry {
  id: string;
  at: string;
  level: "INFO" | "WARN" | "ERROR" | string;
  service: string | null;
  /** Correlation id: request or job. */
  request_id: string | null;
  job_id: string | null;
  message: string | null;
}

export interface LogListParams {
  service?: string;
  level?: string;
  request_id?: string;
  job_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ApiUsageResponse {
  requests: number | null;
  ok_2xx: number | null;
  errors_4xx: number | null;
  errors_5xx: number | null;
  latency: LatencyStats | null;
  rate_limited: number | null;
  requests_over_time: TimePoint[] | null;
  top_endpoints: { endpoint: string; requests: number | null; errors: number | null; p95_ms: number | null }[] | null;
  requests_by_service: { label: string; value: number }[] | null;
  updated_at: string | null;
}

export interface ApiEndpointGroup {
  name: string;
  status: HealthState;
  latency: LatencyStats | null;
  error_rate: number | null;
  last_checked_at: string | null;
}

export interface ApiHealthDetail {
  groups: ApiEndpointGroup[];
  updated_at: string | null;
}

export interface DatabaseHealth {
  connected: boolean | null;
  state: HealthState;
  latency: LatencyStats | null;
  pool_utilization: number | null;
  active_connections: number | null;
  slow_queries: number | null;
  version: string | null;
  migration_status: string | null;
  storage: { used_bytes: number | null; total_bytes: number | null } | null;
  updated_at: string | null;
}

// ---------- 18. Operations (live ops) ----------

export interface OperationsSnapshot {
  active_calls: number | null;
  queued_calls: number | null;
  completed_calls: number | null;
  failed_calls: number | null;
  ai_conversations: number | null;
  human_transfers: number | null;
  pending_analysis: number | null;
  pending_follow_ups: number | null;
  queue_depth: number | null;
  workers_available: number | null;
  workers_total: number | null;
  telephony_available: number | null;
  telephony_total: number | null;
  ai_providers_available: number | null;
  ai_providers_total: number | null;
  recent_events: InfraEvent[];
  updated_at: string | null;
}
