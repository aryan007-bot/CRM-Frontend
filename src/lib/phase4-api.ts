/**
 * Phase 4 control-plane API client.
 *
 * Every request goes through the same `request`/`requestData` core as the
 * Phase 1–3 client (bearer token, envelope unwrap, typed ApiError) — no
 * ad-hoc fetch sites.
 *
 * Mock adapter: when `NEXT_PUBLIC_USE_MOCKS=true` the module resolves a
 * dev-only in-memory mock instead of the network, so the UI can be built and
 * demoed before the Phase 4 backend exists. The mock lives in
 * `./phase4-mock.ts`, imports nothing from production code paths, and is
 * statically skipped by the bundler when the flag is off. Production builds
 * never fall back silently: with mocks disabled the real endpoints are called.
 */

import { requestData, request, type QueryValue } from "./api";
import type { Paginated } from "./types";
import type {
  AIModel,
  AIModelDetail,
  Alert,
  AlertDetail,
  ApiHealthDetail,
  ApiUsageResponse,
  AuditEntry,
  CapacityMetrics,
  ConfigurationItem,
  ConfigurationUpdate,
  DatabaseHealth,
  Deployment,
  DeploymentDetail,
  EnvironmentHealth,
  EventStreamParams,
  InfraEvent,
  InfraQueue,
  InfraQueueDetail,
  Incident,
  IncidentDetail,
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
  QuotaUsage,
  RoutingOverview,
  RoutingRule,
  RoutingRuleInput,
  SecurityEvent,
  SecurityEventListParams,
  ServiceDetail,
  ServiceHealth,
  SystemHealth,
  TelephonyGatewayInfra,
  TelephonyInfra,
  UsageQuery,

  UsageResponse,
  VoiceInfra,
  Worker,
  WorkerDetail,
} from "./phase4-types";

// ---------- Mock resolution (dev only) ----------

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Shape of the dev mock module — mirrors the functions used below. */
interface Phase4Mock {
  getSystemHealth(): Promise<SystemHealth>;
  listServices(): Promise<ServiceHealth[]>;
  getService(id: string): Promise<ServiceDetail>;
  listWorkers(): Promise<Worker[]>;
  getWorker(id: string): Promise<WorkerDetail>;
  workerAction(id: string, action: string): Promise<WorkerDetail>;
  listQueues(): Promise<InfraQueue[]>;
  getQueue(id: string): Promise<InfraQueueDetail>;
  queueAction(id: string, action: string): Promise<InfraQueueDetail>;
  listJobs(params: JobListParams): Promise<Paginated<Job>>;
  getJob(id: string): Promise<JobDetail>;
  jobAction(id: string, action: string): Promise<JobDetail>;
  getTelephonyInfra(): Promise<TelephonyInfra>;
  getDatabaseHealth(): Promise<DatabaseHealth>;
  listEnvironments(): Promise<EnvironmentHealth[]>;
  getCapacity(): Promise<CapacityMetrics>;
  getPerformance(timeframe: string): Promise<PerformanceResponse>;
  listLogs(params: LogListParams): Promise<Paginated<LogEntry>>;
  getApiUsage(): Promise<ApiUsageResponse>;
  getApiHealth(): Promise<ApiHealthDetail>;
  getAIInfrastructure(): Promise<Record<string, unknown>>;
  listProviders(): Promise<Provider[]>;
  getProvider(id: string): Promise<ProviderDetail>;
  updateProvider(id: string, patch: ProviderMutation): Promise<ProviderDetail>;
  testProvider(id: string): Promise<ProviderDetail>;
  listModels(): Promise<AIModel[]>;
  getModel(id: string): Promise<AIModelDetail>;
  getRouting(): Promise<RoutingOverview>;
  createRoutingRule(input: RoutingRuleInput): Promise<RoutingRule>;
  updateRoutingRule(id: string, patch: Partial<RoutingRuleInput>): Promise<RoutingRule>;
  deleteRoutingRule(id: string): Promise<void>;
  getUsage(query: UsageQuery): Promise<UsageResponse>;
  getVoiceInfra(): Promise<VoiceInfra>;
  listIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<IncidentDetail>;
  updateIncident(id: string, patch: Record<string, unknown>): Promise<IncidentDetail>;
  listAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<AlertDetail>;
  alertAction(id: string, action: string): Promise<AlertDetail>;
  listDeployments(): Promise<Deployment[]>;
  getDeployment(id: string): Promise<DeploymentDetail>;
  listEvents(params: EventStreamParams): Promise<Paginated<InfraEvent>>;
  getOperations(): Promise<OperationsSnapshot>;
  listConfiguration(): Promise<ConfigurationItem[]>;
  updateConfiguration(key: string, patch: ConfigurationUpdate): Promise<ConfigurationItem>;
  listSecurityEvents(params: SecurityEventListParams): Promise<Paginated<SecurityEvent>>;
  listAudit(params: Record<string, unknown>): Promise<Paginated<AuditEntry>>;
}

async function mock(): Promise<Phase4Mock> {
  if (!USE_MOCKS) {
    throw new Error("phase4-mock requested but NEXT_PUBLIC_USE_MOCKS is not enabled");
  }
  return (await import("./phase4-mock")) as unknown as Phase4Mock;
}

/** Delegates to the mock when enabled, otherwise calls the real API. */
function withMock<A extends unknown[], T>(
  real: (...args: A) => Promise<T>,
  mocked: (m: Phase4Mock, ...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  return (...args: A) =>
    USE_MOCKS ? mock().then((m) => mocked(m, ...args)) : real(...args);
}

const BASE = "/api/v1";

async function requestList<T>(path: string, options?: Parameters<typeof request>[1]): Promise<T[]> {
  const res = await request<Paginated<T> | T[]>(path, options);
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object" && Array.isArray((res as Paginated<T>).items)) {
    return (res as Paginated<T>).items;
  }
  return [];
}

// ---------- System ----------

export const systemApi = {
  getHealth: withMock(
    () => requestData<SystemHealth>(`${BASE}/system/health`),
    (m) => m.getSystemHealth(),
  ),
};

// ---------- Services ----------

export const servicesApi = {
  list: withMock(
    () => requestList<ServiceHealth>(`${BASE}/services`),
    (m) => m.listServices(),
  ),
  get: withMock(
    (id: string) => requestData<ServiceDetail>(`${BASE}/services/${id}`),
    (m, id: string) => m.getService(id),
  ),
};

// ---------- Workers ----------

export const workersApi = {
  list: withMock(
    () => requestList<Worker>(`${BASE}/workers`),
    (m) => m.listWorkers(),
  ),
  get: withMock(
    (id: string) => requestData<WorkerDetail>(`${BASE}/workers/${id}`),
    (m, id: string) => m.getWorker(id),
  ),
  action: withMock(
    (id: string, action: "drain" | "resume" | "restart" | "disable") =>
      requestData<WorkerDetail>(`${BASE}/workers/${id}/actions`, { method: "POST", body: { action } }),
    (m, id: string, action: "drain" | "resume" | "restart" | "disable") => m.workerAction(id, action),
  ),
};

// ---------- Queues ----------

export const queuesApi = {
  list: withMock(
    () => requestList<InfraQueue>(`${BASE}/queues`),
    (m) => m.listQueues(),
  ),
  get: withMock(
    (id: string) => requestData<InfraQueueDetail>(`${BASE}/queues/${id}`),
    (m, id: string) => m.getQueue(id),
  ),
  action: withMock(
    (id: string, action: "pause" | "resume" | "retry_failed") =>
      requestData<InfraQueueDetail>(`${BASE}/queues/${id}/actions`, { method: "POST", body: { action } }),
    (m, id: string, action: "pause" | "resume" | "retry_failed") => m.queueAction(id, action),
  ),
};

// ---------- Jobs ----------

export const jobsApi = {
  list: withMock(
    (p?: JobListParams) => request<Paginated<Job>>(`${BASE}/jobs`, { query: { ...p } }),
    (m, p?: JobListParams) => m.listJobs(p ?? {}),
  ),
  get: withMock(
    (id: string) => requestData<JobDetail>(`${BASE}/jobs/${id}`),
    (m, id: string) => m.getJob(id),
  ),
  action: withMock(
    (id: string, action: "retry" | "cancel") =>
      requestData<JobDetail>(`${BASE}/jobs/${id}/actions`, { method: "POST", body: { action } }),
    (m, id: string, action: "retry" | "cancel") => m.jobAction(id, action),
  ),
};

// ---------- Telephony / database / environments / capacity ----------

export const infraApi = {
  telephony: withMock(
    async () => {
      const res = await requestData<TelephonyInfra | TelephonyGatewayInfra[]>(`${BASE}/telephony/infrastructure`);
      if (Array.isArray(res)) {
        const activeCalls = res.reduce((acc, g) => acc + (g.active_calls || 0), 0);
        return {
          gateways: res,
          active_channels: activeCalls,
          active_calls: activeCalls,
          sip_registrations: res.filter((g) => (g as unknown as { status?: string }).status === "ONLINE" || g.state === "ONLINE").length,

          gsm_online: 0,
          gsm_total: 0,
          setup_latency: null,
          failed_call_rate: null,
          errors: [],
          updated_at: new Date().toISOString(),
        };
      }
      return res;
    },
    (m) => m.getTelephonyInfra(),
  ),
  database: withMock(
    () => requestData<DatabaseHealth>(`${BASE}/system/database`),
    (m) => m.getDatabaseHealth(),
  ),
  environments: withMock(
    () => requestList<EnvironmentHealth>(`${BASE}/environments`),
    (m) => m.listEnvironments(),
  ),
  capacity: withMock(
    () => requestData<CapacityMetrics>(`${BASE}/capacity`),
    (m) => m.getCapacity(),
  ),
};


// ---------- Performance / logs / api usage ----------

export const performanceApi = {
  get: withMock(
    (timeframe: string) => requestData<PerformanceResponse>(`${BASE}/performance`, { query: { timeframe } }),
    (m, timeframe: string) => m.getPerformance(timeframe),
  ),
};

export const logsApi = {
  list: withMock(
    (params?: LogListParams) => request<Paginated<LogEntry>>(`${BASE}/logs`, { query: { ...params } }),
    (m, params?: LogListParams) => m.listLogs(params ?? {}),
  ),
};

export const apiUsageApi = {
  usage: withMock(() => requestData<ApiUsageResponse>(`${BASE}/api-usage`), (m) => m.getApiUsage()),
  health: withMock(() => requestData<ApiHealthDetail>(`${BASE}/api-usage/groups`), (m) => m.getApiHealth()),
};

// ---------- AI platform ----------

export const aiInfraApi = {
  overview: withMock(
    () => requestData<Record<string, unknown>>(`${BASE}/ai/infrastructure`),
    (m) => m.getAIInfrastructure(),
  ),
};

export const providersApi = {
  list: withMock(() => requestList<Provider>(`${BASE}/ai/providers`), (m) => m.listProviders()),
  get: withMock(
    (id: string) => requestData<ProviderDetail>(`${BASE}/ai/providers/${id}`),
    (m, id: string) => m.getProvider(id),
  ),
  update: withMock(
    (id: string, patch: ProviderMutation) =>
      requestData<ProviderDetail>(`${BASE}/ai/providers/${id}`, { method: "PATCH", body: patch }),
    (m, id: string, patch: ProviderMutation) => m.updateProvider(id, patch),
  ),
  test: withMock(
    (id: string) => requestData<ProviderDetail>(`${BASE}/ai/providers/${id}/test`, { method: "POST" }),
    (m, id: string) => m.testProvider(id),
  ),
};

export const modelsApi = {
  list: withMock(() => requestList<AIModel>(`${BASE}/ai/models`), (m) => m.listModels()),
  get: withMock(
    (id: string) => requestData<AIModelDetail>(`${BASE}/ai/models/${id}`),
    (m, id: string) => m.getModel(id),
  ),
};

export const routingApi = {
  overview: withMock(() => requestData<RoutingOverview>(`${BASE}/ai/routing`), (m) => m.getRouting()),
  createRule: withMock(
    (input: RoutingRuleInput) => requestData<RoutingRule>(`${BASE}/ai/routing/rules`, { method: "POST", body: input }),
    (m, input: RoutingRuleInput) => m.createRoutingRule(input),
  ),
  updateRule: withMock(
    (id: string, patch: Partial<RoutingRuleInput>) =>
      requestData<RoutingRule>(`${BASE}/ai/routing/rules/${id}`, { method: "PATCH", body: patch }),
    (m, id: string, patch: Partial<RoutingRuleInput>) => m.updateRoutingRule(id, patch),
  ),
  deleteRule: withMock(
    (id: string) => request<void>(`${BASE}/ai/routing/rules/${id}`, { method: "DELETE" }),
    (m, id: string) => m.deleteRoutingRule(id),
  ),
};

export const usageApi = {
  get: withMock(
    (query?: UsageQuery) => requestData<UsageResponse>(`${BASE}/ai/usage`, { query: { ...query } }),
    (m, query?: UsageQuery) => m.getUsage(query ?? {}),
  ),
  /** Provider quota — read from the provider record to avoid a duplicate endpoint. */
  quota: withMock(
    async (providerId: string) => {
      const providers = await requestList<Provider>(`${BASE}/ai/providers`);
      return providers.find((p) => p.id === providerId)?.quota ?? null;
    },
    async (m, providerId: string) => {
      const providers = await m.listProviders();
      return providers.find((p) => p.id === providerId)?.quota ?? null;
    },
  ),
};

export const voiceApi = {
  infra: withMock(() => requestData<VoiceInfra>(`${BASE}/ai/voice/infrastructure`), (m) => m.getVoiceInfra()),
};

// ---------- Reliability ----------

export const incidentsApi = {
  list: withMock(() => requestList<Incident>(`${BASE}/incidents`), (m) => m.listIncidents()),
  get: withMock(
    (id: string) => requestData<IncidentDetail>(`${BASE}/incidents/${id}`),
    (m, id: string) => m.getIncident(id),
  ),
  update: withMock(
    (id: string, patch: Record<string, unknown>) =>
      requestData<IncidentDetail>(`${BASE}/incidents/${id}`, { method: "PATCH", body: patch }),
    (m, id: string, patch: Record<string, unknown>) => m.updateIncident(id, patch),
  ),
};

export const alertsApi = {
  list: withMock(() => requestList<Alert>(`${BASE}/alerts`), (m) => m.listAlerts()),
  get: withMock(
    (id: string) => requestData<AlertDetail>(`${BASE}/alerts/${id}`),
    (m, id: string) => m.getAlert(id),
  ),
  action: withMock(
    (id: string, action: "acknowledge" | "resolve" | "disable") =>
      requestData<AlertDetail>(`${BASE}/alerts/${id}/actions`, { method: "POST", body: { action } }),
    (m, id: string, action: "acknowledge" | "resolve" | "disable") => m.alertAction(id, action),
  ),
};

// ---------- Deployments ----------

export const deploymentsApi = {
  list: withMock(() => requestList<Deployment>(`${BASE}/deployments`), (m) => m.listDeployments()),
  get: withMock(
    (id: string) => requestData<DeploymentDetail>(`${BASE}/deployments/${id}`),
    (m, id: string) => m.getDeployment(id),
  ),
};

// ---------- Events / operations ----------

export const eventsApi = {
  list: withMock(
    (params?: EventStreamParams) => request<Paginated<InfraEvent>>(`${BASE}/events`, { query: { ...params } }),
    (m, params?: EventStreamParams) => m.listEvents(params ?? {}),
  ),
};

export const operationsApi = {
  snapshot: withMock(
    () => requestData<OperationsSnapshot>(`${BASE}/operations/snapshot`),
    (m) => m.getOperations(),
  ),
};

// ---------- Configuration ----------

export const configurationApi = {
  list: withMock(
    () => requestList<ConfigurationItem>(`${BASE}/configuration`),
    (m) => m.listConfiguration(),
  ),
  update: withMock(
    (key: string, patch: ConfigurationUpdate) =>
      requestData<ConfigurationItem>(`${BASE}/configuration/${key}`, { method: "PATCH", body: patch }),
    (m, key: string, patch: ConfigurationUpdate) => m.updateConfiguration(key, patch),
  ),
};


// ---------- Security / audit ----------

export const securityApi = {
  listEvents: withMock(
    (params?: SecurityEventListParams) =>
      request<Paginated<SecurityEvent>>(`${BASE}/security/events`, { query: { ...params } }),
    (m, params?: SecurityEventListParams) => m.listSecurityEvents(params ?? {}),
  ),
};

export const auditApi = {
  list: withMock(
    (params?: Record<string, QueryValue>) =>
      request<Paginated<AuditEntry>>(`${BASE}/audit`, { query: params }),
    (m, params?: Record<string, QueryValue>) => m.listAudit(params ?? {}),
  ),
};
