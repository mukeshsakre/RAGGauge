import { test, expect, type Page } from '@playwright/test';
import { parseDatasetFile } from '../src/utils/datasetImport';
import { hydrateWorkspaceData, mockExperiments } from '../src/mockData';

const api = 'http://127.0.0.1:8011';
const tokens: Record<string, string> = {};
const headers = (role = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
async function enter(page: Page, role = 'admin') {
  await page.addInitScript(token => sessionStorage.setItem('ragguage_session', token), tokens[role]);
  await page.goto('/');
  await expect(page.locator('aside')).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page.locator('aside').getByRole('button', { name, exact: false }).first().click();
}

test.beforeAll(async ({ request }) => {
  for (const role of ['admin', 'engineer', 'viewer']) {
    const response = await request.post(`${api}/sessions`, { data: { username: role, password: 'browser-test-password' } });
    expect(response.ok()).toBeTruthy();
    tokens[role] = (await response.json()).token;
  }
});

test('login uses database credentials, readable password, reload, and session revocation', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('ragguage_auth_user', JSON.stringify({ name: 'fake', role: 'ADMIN' })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  const styles = await page.getByLabel('Password', { exact: true }).evaluate(element => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element.parentElement!).backgroundColor,
  }));
  expect(styles.foreground).not.toBe(styles.background);
  expect(styles.background).not.toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'fixture-candidate', exact: true })).toBeVisible();
  const token = await page.evaluate(() => sessionStorage.getItem('ragguage_session'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'fixture-candidate', exact: true })).toBeVisible();
  await page.locator('aside').getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect((await request.get(`${api}/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403);
});

test('screens show persisted data and drill into exact run/case without crashes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await page.getByRole('button', { name: 'Open run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'fixture-candidate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'q00', exact: true }).click();
  await expect(page.getByText('Where is policy 0?', { exact: true })).toBeVisible();
  for (const screen of ['Datasets', 'Experiments', 'Models & Judges', 'Adapters', 'Configuration', 'Pipeline Lab']) {
    await nav(page, screen);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('native dataset import preserves graded relevance, stable source spans, and corpus version', async ({ page, request }) => {
  await enter(page);
  await nav(page, 'Datasets');
  await page.getByRole('button', { name: /Create Dataset|New Dataset|Import Dataset/i }).first().click();
  await page.getByPlaceholder('e.g. Legal Contract Clauses v1').fill('Browser imported benchmark');
  await page.getByRole('button', { name: 'Next Step', exact: true }).click();
  await page.getByRole('button', { name: '.json', exact: true }).click();
  const source = (await (await request.get(`${api}/datasets`, { headers: headers() })).json())[0];
  source.cases = source.cases.slice(0, 1);
  source.cases[0].relevance.graded = true;
  source.cases[0].relevance.labels.A = 3;
  await page.locator('input[type=file]').setInputFiles({ name: 'benchmark.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.getByText('Loaded benchmark.json (1 cases detected)', { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next Step', exact: true }).click();
  const saved = page.waitForResponse(response => response.url().endsWith('/api/datasets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save and Open Dataset Detail', exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  const record = await response.json();
  expect(record.corpus_version).toBe(source.corpus_version);
  expect(record.cases[0].relevance).toEqual(source.cases[0].relevance);
  expect(record.cases[0].evidence).toEqual(source.cases[0].evidence);
  await expect(page.getByRole('heading', { name: 'Browser imported benchmark', exact: true })).toBeVisible();
});

test('CSV supports quoted commas, multiline text, evidence arrays, and rejects malformed rows', () => {
  const parsed = parseDatasetFile('id,question,ground_truth_contexts\r\nq1,"What, exactly?\nExplain.","[""source A""]"', 'csv');
  expect(parsed.records[0]).toEqual({ id: 'q1', question: 'What, exactly?\nExplain.', ground_truth_contexts: ['source A'] });
  expect(() => parseDatasetFile('id,question\nq1,"unclosed', 'csv')).toThrow();
  expect(() => parseDatasetFile('id,id\nx,y', 'csv')).toThrow();
  expect(() => parseDatasetFile('id,question\nx,y,z', 'csv')).toThrow();
});

test('paired comparison, diagnosis and reviewed recommendation persist without automatically running', async ({ page, request }) => {
  await enter(page);
  await nav(page, 'Compare Runs');
  await page.getByLabel('Baseline run').selectOption('fixture-baseline');
  await page.getByLabel('Candidate run').selectOption('fixture-candidate');
  const analyzed = page.waitForResponse(response => response.url().endsWith('/api/comparisons') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Analyze runs', exact: true }).click();
  const response = await analyzed;
  expect(response.ok()).toBeTruthy();
  const comparison = await response.json();
  const recall = comparison.metric_deltas.find((metric: any) => metric.name === 'recall@5');
  expect(recall.baseline_mean).toBe(1);
  expect(recall.candidate_mean).toBe(0.5);
  expect(recall.paired_case_ids).toHaveLength(10);
  await expect(page.getByText('retrieval.dense.top_k', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regression diagnosis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'retrieval_recall · DETECTED', exact: true })).toBeVisible();
  await expect(page.getByText('5 CHANGED CASES', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'q00', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Case q00', exact: true })).toBeVisible();
  await nav(page, 'Compare Runs');
  await page.getByRole('button', { name: 'Recommendations', exact: true }).click();
  const jobsBefore = await (await request.get(`${api}/jobs`, { headers: headers() })).json();
  await page.getByRole('button', { name: 'Create Suggested Experiment', exact: true }).first().click();
  await expect(page.getByText('Review suggested experiment', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and create draft', exact: true }).click();
  // Also verify through storage; creation endpoint path is an implementation detail.
  await expect(page.getByText('This experiment is a draft and has no persisted execution yet.', { exact: true })).toBeVisible();
  const experiments = await (await request.get(`${api}/experiments`, { headers: headers() })).json();
  expect(experiments.some((experiment: any) => experiment.id !== 'experiment-baseline' && experiment.configuration.retrieval?.dense?.top_k === 20)).toBeTruthy();
  expect(await (await request.get(`${api}/jobs`, { headers: headers() })).json()).toEqual(jobsBefore);
});

test('external adapter wizard queues a real worker execution and opens persisted metrics', async ({ page, request }) => {
  await enter(page, 'engineer');
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await page.getByText('Evaluate Existing RAG', { exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const queued = page.waitForResponse(response => /\/api\/experiments\/[^/]+\/runs$/.test(response.url()) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run Experiment Now', exact: true }).click();
  const response = await queued;
  expect(response.ok()).toBeTruthy();
  const job = await response.json();
  await page.getByRole('button', { name: 'Open persisted run', exact: true }).click();
  await expect(page.getByText('recall@10', { exact: false }).first()).toBeVisible();
  const runs = await (await request.get(`${api}/runs`, { headers: headers() })).json();
  const run = runs.find((item: any) => item.experiment_id === job.experiment_id);
  expect(run.status).toBe('COMPLETED');
  expect(run.cases).toHaveLength(10);
  expect(run.cases.every((item: any) => item.trace && item.metrics.every((metric: any) => metric.status === 'SUCCESS'))).toBeTruthy();
});

test('admin configuration is versioned/audited; viewer and engineer cannot change platform policy', async ({ page, request }) => {
  await enter(page);
  await nav(page, 'Configuration');
  const configBefore = await (await request.get(`${api}/configuration/platform`, { headers: headers() })).json();
  const runsBefore = await (await request.get(`${api}/runs`, { headers: headers() })).json();
  await page.getByLabel('pipeline.reranking', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  const configAfter = await (await request.get(`${api}/configuration/platform`, { headers: headers() })).json();
  expect(configAfter.revision).toBe(configBefore.revision + 1);
  expect(configAfter.values['pipeline.reranking']).toBe(false);
  expect((await (await request.get(`${api}/audit`, { headers: headers() })).json()).some((entry: any) => entry.key === 'pipeline.reranking')).toBeTruthy();
  expect(await (await request.get(`${api}/runs`, { headers: headers() })).json()).toEqual(runsBefore);
  expect((await request.put(`${api}/configuration/platform`, { headers: headers(), data: { values: configBefore.values, expected_revision: configBefore.revision } })).status()).toBe(409);
  for (const role of ['viewer', 'engineer']) {
    expect((await request.put(`${api}/configuration/platform`, { headers: headers(role), data: { values: {}, expected_revision: configAfter.revision } })).status()).toBe(403);
  }
  expect((await request.post(`${api}/comparisons`, { headers: headers('viewer'), data: { baseline_run_id: 'fixture-baseline', candidate_run_id: 'fixture-candidate' } })).status()).toBe(403);
  // Restore policy for following tests, also through its normal audited mutation.
  expect((await request.put(`${api}/configuration/platform`, { headers: headers(), data: { values: configBefore.values, expected_revision: configAfter.revision } })).ok()).toBeTruthy();
});

test('viewer can inspect results but cannot run or create experiments', async ({ page }) => {
  await enter(page, 'viewer');
  await expect(page.locator('aside').getByRole('button', { name: 'Configuration', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run again', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await expect(page.getByText(/VIEWER access is read-only/)).toBeVisible();
});

test('pipeline draft retains the selected corpus and never queues execution', async ({ page, request }) => {
  await enter(page, 'engineer');
  await page.getByRole('button', { name: 'Eval', exact: true }).click();
  await page.getByText('Full Pipeline Lab', { exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const jobsBefore = await (await request.get(`${api}/jobs`, { headers: headers() })).json();
  const created = page.waitForResponse(response => response.url().endsWith('/api/experiments') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
  const response = await created;
  expect(response.ok()).toBeTruthy();
  const draft = await response.json();
  expect(draft.corpus_version).toBe('fixture-corpus-v1');
  expect(draft.dataset_version).toBe('fixture-dataset-v1');
  expect(draft.configuration.generation.enabled).toBe(false);
  expect(draft.configuration.evaluation.metrics).toEqual(['recall@10', 'ndcg@10']);
  expect(await (await request.get(`${api}/jobs`, { headers: headers() })).json()).toEqual(jobsBefore);
});

test('view models preserve unknown scores and distinguish stage, evaluator, and run failures', () => {
  const snapshot: any = {
    user: { username: 'tester' }, datasets: [], experiments: [], comparisons: [], models: [], adapters: [], jobs: [],
    runs: [{ id: 'partial', dataset_version: 'ds', status: 'COMPLETED_WITH_ERRORS', cases: [{
      trace: { total_latency: { value: null }, costs: { APPLICATION_EXECUTION_COST: { value: null } } },
      metrics: [
        { name: 'recall@10', status: 'SUCCESS', score: 0.8, stage: 'DENSE_RETRIEVAL', evaluator_id: 'deterministic' },
        { name: 'recall@10', status: 'SUCCESS', score: 0.6, stage: 'RERANKED_RETRIEVAL', evaluator_id: 'deterministic' },
        { name: 'faithfulness', status: 'NOT_EVALUATED', score: null },
      ],
    }] }, { id: 'cancelled', dataset_version: 'ds', status: 'CANCELLED', cases: [] }],
  };
  hydrateWorkspaceData(snapshot);
  expect(mockExperiments[0].metrics.recall10).toBe(0.6);
  expect(mockExperiments[0].metrics.faithfulness).toBeNaN();
  expect(mockExperiments[0].metrics.avgLatency).toBeNaN();
  expect(mockExperiments[0].metrics.estimatedCost).toBeNaN();
  expect(mockExperiments[0].status).toBe('Completed with errors');
  expect(mockExperiments[1].status).toBe('Cancelled');
});
