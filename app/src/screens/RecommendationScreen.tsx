import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, GitBranch, Sparkles } from 'lucide-react';
import { createSuggestedExperiment, previewSuggestedExperiment } from '../api';
import { StAlert, StBadge, StButton, StCodeBlock } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; baselineId?: string; currentId?: string; }
const printable = (value: unknown) => JSON.stringify(value, null, 2);

export const RecommendationScreen: React.FC<Props> = ({ onNavigate, baselineId = '', currentId = '' }) => {
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const comparison = useMemo(() => [...snapshot.comparisons].reverse().find(item => item.baseline_run_id === baselineId && item.candidate_run_id === currentId), [snapshot.comparisons, baselineId, currentId]);
  const recommendations = comparison?.recommendations || [];
  const objective = comparison?.objective;

  const exportReport = () => {
    if (!comparison) return;
    const text = `# RAGGauge recommendation\n\nBaseline: ${baselineId}\nCandidate: ${currentId}\nObjective: ${objective?.kind || 'Diagnostic next experiment'}\n\n${recommendations.map((item: any) => `## ${item.objective}\n${item.explanation}\n\nConfidence: ${item.confidence}\nOverrides:\n\`\`\`json\n${printable(item.overrides || {})}\n\`\`\``).join('\n\n') || 'No recommendation was emitted.'}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ragguage-${comparison.id}.md`; anchor.click(); URL.revokeObjectURL(url);
  };

  const preview = async (recommendation: any) => {
    setBusy(true);
    try { setDraft({ recommendationId: recommendation.id, experiment: await previewSuggestedExperiment(comparison.id, recommendation.id) }); }
    catch (error) { showToast({ type: 'error', title: 'Preview failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
    finally { setBusy(false); }
  };
  const create = async (recommendation: any) => {
    setBusy(true);
    try { const experiment = await createSuggestedExperiment(comparison.id, recommendation.id); await refresh(); showToast({ type: 'success', title: 'Suggested experiment created', message: 'The draft was created without starting a run.' }); onNavigate('experiment_details', { experimentId: experiment.id }); }
    catch (error) { showToast({ type: 'error', title: 'Creation failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
    finally { setBusy(false); }
  };

  if (!comparison) return <div className="max-w-4xl mx-auto"><StAlert type="warning">No persisted comparison matches these runs. Create the comparison before requesting recommendations.</StAlert></div>;

  return <div className="max-w-4xl mx-auto space-y-5">
    <header className="bg-[#15171e] rounded-xl border border-[#272a33] p-5 flex items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><button onClick={() => onNavigate('compare', { selected: [baselineId, currentId] })} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><Sparkles className="w-5 h-5 text-[#ff7733]" /><h1 className="text-base sm:text-lg font-bold font-mono">Evidence-backed recommendations</h1></div><p className="mt-2 text-xs font-mono text-zinc-400">{currentId} against {baselineId}</p></div>
      <StButton label="Export Markdown" icon={<Download className="w-4 h-4" />} variant="secondary" onClick={exportReport} />
    </header>
    <section className="grid sm:grid-cols-3 gap-3">
      <div className="p-4 rounded-xl border bg-[#15171e] "><div className="text-xs text-zinc-400">Objective</div><div className="font-bold mt-1">{objective?.kind || 'Diagnostic next experiment'}</div></div>
      <div className="p-4 rounded-xl border bg-[#15171e] "><div className="text-xs text-zinc-400">Change isolation</div><div className="font-bold mt-1">{comparison.change_isolation}</div></div>
      <div className="p-4 rounded-xl border bg-[#15171e] "><div className="text-xs text-zinc-400">Observations</div><div className="font-mono font-bold text-xl mt-1">{comparison.observations?.length || 0}</div></div>
    </section>
    {!recommendations.length ? <StAlert type="info">The deterministic rules abstained. Available evidence does not support a controlled recommendation.</StAlert> : recommendations.map((recommendation: any) => <section key={recommendation.id} className="p-5 rounded-xl border border-[#272a33] bg-[#15171e] space-y-4">
      <div className="flex justify-between gap-4"><div><h2 className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{recommendation.objective}</h2><p className="text-sm text-zinc-400 mt-2">{recommendation.explanation}</p></div><StBadge type="status" label={recommendation.confidence || 'UNSPECIFIED'} /></div>
      <StCodeBlock code={printable(recommendation.overrides || {})} language="json" title="Recommended override" />
      <div className="text-xs text-zinc-400">Expected observation: {recommendation.expected_observation || 'Not recorded'} · Evidence: {recommendation.evidence_refs?.length || 0} references</div>
      {draft?.recommendationId === recommendation.id && <div className="rounded-xl border border-[#422720] bg-[#251e1b] p-4"><div className="font-bold text-sm mb-2">Review suggested experiment</div><StCodeBlock code={printable(draft.experiment)} language="json" title="Immutable draft preview" /><div className="mt-3"><StButton label={busy ? 'Creating…' : 'Confirm and create draft'} icon={<GitBranch className="w-4 h-4" />} disabled={busy || snapshot.user.role === 'VIEWER'} onClick={() => create(recommendation)} /></div></div>}
      {recommendation.kind === 'CONTROLLED_EXPERIMENT' && draft?.recommendationId !== recommendation.id && <StButton label={busy ? 'Preparing…' : 'Create Suggested Experiment'} icon={<GitBranch className="w-4 h-4" />} disabled={busy || snapshot.user.role === 'VIEWER'} onClick={() => preview(recommendation)} />}
    </section>)}
  </div>;
};
