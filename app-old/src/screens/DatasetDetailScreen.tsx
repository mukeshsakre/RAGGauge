import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Play, Search } from 'lucide-react';
import { StAlert, StBadge, StButton, StCodeBlock } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; datasetId?: string; }
export const DatasetDetailScreen: React.FC<Props> = ({ onNavigate, datasetId }) => {
  const { snapshot } = useRAGGauge();
  const [query, setQuery] = useState('');
  const dataset = snapshot.datasets.find(item => item.id === datasetId);
  const cases = useMemo(() => (dataset?.cases || []).filter((item: any) => `${item.id} ${item.question} ${item.metadata?.category || ''}`.toLowerCase().includes(query.toLowerCase())), [dataset, query]);
  if (!dataset) return <StAlert type="warning">The requested persisted dataset does not exist.</StAlert>;
  const exportDataset = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${dataset.id}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const withReference = dataset.cases.filter((item: any) => Boolean(item.reference_answer)).length;
  const withRelevance = dataset.cases.filter((item: any) => Boolean(item.relevance)).length;
  return <div className="space-y-5">
    <header className="p-5 rounded-2xl border bg-white dark:bg-slate-900 flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><button onClick={() => onNavigate('datasets')} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><h1 className="text-xl font-bold">{dataset.name}</h1><StBadge type="version" label={`v${dataset.version}`} /></div><p className="text-xs font-mono text-slate-500 mt-2">{dataset.id} · {dataset.corpus_version ? `corpus ${dataset.corpus_version}` : 'external evidence dataset'}</p></div><div className="flex gap-2"><StButton label="Export JSON" icon={<Download className="w-4 h-4" />} variant="secondary" onClick={exportDataset} /><StButton label="New experiment" icon={<Play className="w-4 h-4" />} onClick={() => onNavigate('new_experiment', { datasetId: dataset.id })} /></div></header>
    <section className="grid sm:grid-cols-3 gap-3"><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Cases</div><div className="text-2xl font-bold font-mono">{dataset.cases.length}</div></div><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Reference answers</div><div className="text-2xl font-bold font-mono">{withReference}/{dataset.cases.length}</div></div><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Relevance labels</div><div className="text-2xl font-bold font-mono">{withRelevance}/{dataset.cases.length}</div></div></section>
    <section className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden"><div className="p-5 flex items-center justify-between gap-4"><div><h2 className="font-bold text-sm">Evaluation cases</h2><p className="text-xs text-slate-500 mt-1">Ground truth and eligibility evidence stored in this immutable version.</p></div><label className="flex items-center gap-2 rounded-lg border px-3 min-h-10"><Search className="w-4 h-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search cases" className="bg-transparent outline-none text-xs" /></label></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3 text-left">Case</th><th className="p-3 text-left">Question</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Reference</th><th className="p-3 text-left">Relevance</th></tr></thead><tbody>{cases.map((item: any) => <tr key={item.id} className="border-t"><td className="p-3 font-mono">{item.id}</td><td className="p-3 max-w-lg">{item.question}</td><td className="p-3">{item.metadata?.category || 'Uncategorized'}</td><td className="p-3">{item.reference_answer ? 'AVAILABLE' : 'MISSING'}</td><td className="p-3">{item.relevance ? `${item.relevance.level.toUpperCase()} LABELS` : 'MISSING'}</td></tr>)}</tbody></table></div></section>
    <StCodeBlock code={JSON.stringify({ id: dataset.id, name: dataset.name, version: dataset.version, corpus_version: dataset.corpus_version, created_at: dataset.created_at }, null, 2)} language="json" title="Dataset version identity" />
  </div>;
};
