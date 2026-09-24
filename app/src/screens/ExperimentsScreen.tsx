import React, { useState } from 'react';
import { 
  FlaskConical, 
  Filter, 
  Search, 
  GitCompare, 
  Play, 
  RotateCw, 
  ChevronRight, 
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { StBadge, StButton } from '../components/ui/StreamlitComponents';
import { mockExperiments } from '../mockData';
import { ScreenId } from '../types';

const metric = (value: number) => Number.isFinite(value) ? value.toFixed(2) : 'Not evaluated';
const seconds = (value: number) => Number.isFinite(value) ? `${value.toFixed(3)}s` : 'Not recorded';
const money = (value: number) => Number.isFinite(value) ? `$${value.toFixed(4)}` : 'Not recorded';

interface ExperimentsScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const ExperimentsScreen: React.FC<ExperimentsScreenProps> = ({ onNavigate }) => {
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>(
    mockExperiments.filter(experiment => experiment.status === 'Completed').slice(0, 2).map(experiment => experiment.id)
  );
  const [modeFilter, setModeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSelect = (id: string) => {
    if (selectedExpIds.includes(id)) {
      setSelectedExpIds(selectedExpIds.filter(i => i !== id));
    } else {
      setSelectedExpIds([...selectedExpIds, id]);
    }
  };

  const filteredExperiments = mockExperiments.filter(exp => {
    const matchesSearch = exp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.configurationSummary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = modeFilter === 'All' || exp.mode === modeFilter;
    const matchesStatus = statusFilter === 'All' || exp.status === statusFilter;
    return matchesSearch && matchesMode && matchesStatus;
  });

  return (
    <div className="space-y-6 relative pb-16">
      {/* Header with Title & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Benchmark Experiments</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Systematic benchmark runs measuring retrieval precision, context grounding, latency overhead, and API cost.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StButton
            id="btn-new-experiment"
            label="New Experiment"
            icon={<Plus className="w-4 h-4" />}
            variant="primary"
            onClick={() => onNavigate('new_experiment')}
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search experiments by ID, model, retriever..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Mode:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="All">All Modes</option>
              <option value="pipeline">Pipeline Lab</option>
              <option value="adapter">Existing RAG</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Running">Running</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500 font-mono text-xs">
          {selectedExpIds.length} selected for comparison
        </div>
      </div>

      {/* Sticky Compare Action Bar when 2+ experiments selected */}
      {selectedExpIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold">{selectedExpIds.length} compatible runs selected</span>
            <span className="text-slate-400 font-mono text-[11px]">({selectedExpIds.join(', ')})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedExpIds([])}
              className="text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
            <button
              onClick={() => onNavigate('compare', { selected: selectedExpIds })}
              className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedExpIds.length === filteredExperiments.length && filteredExperiments.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedExpIds(filteredExperiments.map(x => x.id));
                      } else {
                        setSelectedExpIds([]);
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-3">Experiment</th>
                <th className="py-3 px-3">Dataset & Version</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Configuration</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Recall@10</th>
                <th className="py-3 px-3 text-right">NDCG@10</th>
                <th className="py-3 px-3 text-right">Faithfulness</th>
                <th className="py-3 px-3 text-right">Relevance</th>
                <th className="py-3 px-3 text-right">Avg Latency</th>
                <th className="py-3 px-3 text-right">Cost</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExperiments.map((exp) => {
                const isSelected = selectedExpIds.includes(exp.id);
                return (
                  <tr 
                    key={exp.id} 
                    className={`transition-colors ${
                      isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={exp.status !== 'Completed'}
                        onChange={() => toggleSelect(exp.id)}
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onNavigate('experiment_details', { experimentId: exp.id })}
                        className="hover:underline text-left block"
                      >
                        <div className="flex items-center gap-1.5">
                          <StBadge type="experiment" label={exp.id} />
                          <span className="font-semibold text-slate-900 text-xs">{exp.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Author: {exp.author} • Git: {exp.gitCommit}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 text-[11px]">{exp.datasetId}</div>
                      <StBadge type="version" label={exp.datasetVersion} className="text-[10px] py-0 mt-0.5" />
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        exp.mode === 'pipeline' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {exp.mode === 'pipeline' ? 'Pipeline Lab' : 'Existing RAG'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate text-[11px] font-mono">
                      {exp.configurationSummary}
                    </td>
                    <td className="py-3 px-3">
                      <StBadge type="status" label={exp.status} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                      {metric(exp.metrics.recall10)}
                      {exp.deltas?.recall10 && (
                        <span className={`text-[10px] ml-1 font-normal ${exp.deltas.recall10 > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ({exp.deltas.recall10 > 0 ? '+' : ''}{exp.deltas.recall10.toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-800">
                      {metric(exp.metrics.ndcg10)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                      {metric(exp.metrics.faithfulness)}
                      {exp.deltas?.faithfulness && (
                        <span className={`text-[10px] ml-1 font-normal ${exp.deltas.faithfulness > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ({exp.deltas.faithfulness > 0 ? '+' : ''}{exp.deltas.faithfulness.toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {metric(exp.metrics.answerRelevance)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-800">
                      {seconds(exp.metrics.avgLatency)}
                      {exp.deltas?.avgLatency && (
                        <span className="text-[10px] text-rose-600 block">
                          (+{exp.deltas.avgLatency}s)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {money(exp.metrics.estimatedCost)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onNavigate('experiment_details', { experimentId: exp.id })}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                        >
                          Details
                        </button>
                        <button
                          disabled={exp.status !== 'Completed' || !mockExperiments.some(item => item.status === 'Completed' && item.id !== exp.id)}
                          onClick={() => onNavigate('compare', { selected: [mockExperiments.find(item => item.status === 'Completed' && item.id !== exp.id)?.id, exp.id].filter(Boolean) })}
                          className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px]"
                        >
                          Compare
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
