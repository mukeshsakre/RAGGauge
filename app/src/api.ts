export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

const TOKEN_KEY = 'ragguage_session';

export interface CurrentUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  enabled: boolean;
}

export interface WorkspaceSnapshot {
  user: CurrentUser;
  datasets: any[];
  corpora: any[];
  experiments: any[];
  runs: any[];
  comparisons: any[];
  models: any[];
  adapters: any[];
  jobs: any[];
  configuration: any;
  loadedAt: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function asList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the local RAGGauge API.', 0);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)
        ? body.detail.map((entry: any) => `${entry.loc?.join('.') || 'request'}: ${entry.msg || 'Invalid value'}`).join('; ')
        : message;
    } catch {
      // Keep the status-based fallback when an upstream returns non-JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
  } catch {
    throw new ApiError('Cannot reach the local RAGGauge API. Start PostgreSQL and the API, then try again.', 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail || 'Sign in failed.', response.status);
  }
  const body = await response.json();
  if (!body.token) throw new ApiError('The API did not return a session token.', 500);
  sessionStorage.setItem(TOKEN_KEY, body.token);
  try {
    return await apiRequest<CurrentUser>('/me');
  } catch (error) {
    clearToken();
    throw error;
  }
}

export async function logout() {
  try {
    if (getToken()) await apiRequest('/sessions/current', { method: 'DELETE' });
  } finally {
    clearToken();
  }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  const [user, datasets, corpora, experiments, runs, comparisons, models, adapters, jobs, configuration] =
    await Promise.all([
      apiRequest<CurrentUser>('/me'),
      apiRequest<any>('/datasets'),
      apiRequest<any>('/corpora'),
      apiRequest<any>('/experiments'),
      apiRequest<any>('/runs'),
      apiRequest<any>('/comparisons'),
      apiRequest<any>('/models'),
      apiRequest<any>('/adapters'),
      apiRequest<any>('/jobs'),
      apiRequest<any>('/configuration/effective'),
    ]);
  return {
    user,
    datasets: asList(datasets),
    corpora: asList(corpora),
    experiments: asList(experiments),
    runs: asList(runs),
    comparisons: asList(comparisons),
    models: asList(models),
    adapters: asList(adapters),
    jobs: asList(jobs),
    configuration,
    loadedAt: new Date().toISOString(),
  };
}

export async function createDataset(payload: Record<string, unknown>) {
  return apiRequest<any>('/datasets', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createExperiment(payload: Record<string, unknown>) {
  return apiRequest<any>('/experiments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function preflightExperiment(experimentId: string) {
  return apiRequest<any>(`/experiments/${encodeURIComponent(experimentId)}/preflight`, { method: 'POST' });
}

export async function startExperiment(experimentId: string) {
  return apiRequest<any>(`/experiments/${encodeURIComponent(experimentId)}/runs`, { method: 'POST' });
}

export async function createComparison(baselineRunId: string, candidateRunId: string, objective?: Record<string, unknown>) {
  return apiRequest<any>('/comparisons', {
    method: 'POST',
    body: JSON.stringify({ baseline_run_id: baselineRunId, candidate_run_id: candidateRunId, objective }),
  });
}

export async function createModel(payload: Record<string, unknown>) {
  return apiRequest<any>('/models', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createAdapter(payload: Record<string, unknown>) {
  return apiRequest<any>('/adapters', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getConfiguration(scope: 'platform' | 'workspace:default') {
  return apiRequest<any>(`/configuration/${encodeURIComponent(scope)}`);
}

export async function updateConfiguration(
  scope: 'platform' | 'workspace:default',
  values: Record<string, unknown>,
  expectedRevision: number,
  reason?: string,
) {
  return apiRequest<any>(`/configuration/${encodeURIComponent(scope)}`, {
    method: 'PUT',
    body: JSON.stringify({ values, expected_revision: expectedRevision, reason: reason || null }),
  });
}

export async function previewSuggestedExperiment(comparisonId: string, recommendationId: string) {
  return apiRequest<any>(
    `/comparisons/${encodeURIComponent(comparisonId)}/recommendations/${encodeURIComponent(recommendationId)}/preview`,
    { method: 'POST' },
  );
}

export async function createSuggestedExperiment(comparisonId: string, recommendationId: string) {
  return apiRequest<any>(
    `/comparisons/${encodeURIComponent(comparisonId)}/recommendations/${encodeURIComponent(recommendationId)}/create`,
    { method: 'POST' },
  );
}
