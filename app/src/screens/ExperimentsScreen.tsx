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

const display = (value: number, suffix = '') => Number.isFinite(value) ? `${value.toFixed(3)}${suffix}` : 'Not available';

interface ExperimentsScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const ExperimentsScreen: React.FC<ExperimentsScreenProps> = ({ onNavigate }) => {
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
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
    <div className="space-y-4 relative pb-16">
      {/* Header with Title & Primary CTA */}
      <div className="bg-[#15171e] rounded-xl border border-[#272a33] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#221c1a] text-[#ff7733] border border-[#3e2720]">
                <FlaskConical className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white font-mono">Benchmark Experiments</h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#1e2129] text-zinc-300 border border-[#2c303c]">
                {mockExperiments.length} Runs
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Systematic benchmark runs measuring retrieval precision, context grounding, latency overhead, and API cost.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StButton
              id="btn-new-experiment"
              label="New Experiment"
              icon={<Plus className="w-3.5 h-3.5" />}
              variant="primary"
              size="sm"
              onClick={() => onNavigate('new_experiment')}
            />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-[#15171e] p-2.5 rounded-xl border border-[#272a33] flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search experiments by ID, model, retriever..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#191b22] border border-[#272a33] rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-hidden focus:border-[#ff5500] transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Mode:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-[#191b22] border border-[#272a33] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-[#ff5500] transition-all cursor-pointer font-mono"
            >
              <option value="All">All Modes</option>
              <option value="pipeline">Pipeline Lab</option>
              <option value="adapter">Existing RAG</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#191b22] border border-[#272a33] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-[#ff5500] transition-all cursor-pointer font-mono"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Completed with errors">Completed with errors</option>
              <option value="Running">Running</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Failed">Failed</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="text-zinc-400 font-mono text-[11px]">
          <span className="text-[#ff7733] font-bold">{selectedExpIds.length}</span> selected for comparison
        </div>
      </div>

      {/* Sticky Compare Action Bar when 2+ experiments selected */}
      {selectedExpIds.length >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#15171e] text-zinc-100 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 border border-[#2e323e] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold">{selectedExpIds.length} runs selected</span>
            <span className="text-zinc-400 font-mono text-[10px]">({selectedExpIds.join(', ')})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedExpIds([])}
              className="text-zinc-400 hover:text-white px-2 py-1 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => onNavigate('compare', { selected: selectedExpIds })}
              className="px-3 py-1 rounded-md bg-[#ff5500] hover:bg-[#e04b00] text-white font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-[#15171e] rounded-xl border border-[#272a33] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#181b22] border-b border-[#272a33] text-zinc-400 font-semibold font-mono text-[11px]">
                <th className="py-2 px-2.5 w-8 text-center">
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
                    className="rounded text-[#ff5500] focus:ring-0 cursor-pointer accent-[#ff5500]"
                  />
                </th>
                <th className="py-2 px-2.5">Experiment</th>
                <th className="py-2 px-2.5">Dataset & Version</th>
                <th className="py-2 px-2.5">Mode</th>
                <th className="py-2 px-2.5">Configuration</th>
                <th className="py-2 px-2.5">Status</th>
                <th className="py-2 px-2.5 text-right">Recall@10</th>
                <th className="py-2 px-2.5 text-right">NDCG@10</th>
                <th className="py-2 px-2.5 text-right">Faithfulness</th>
                <th className="py-2 px-2.5 text-right">Relevance</th>
                <th className="py-2 px-2.5 text-right">Avg Latency</th>
                <th className="py-2 px-2.5 text-right">Cost</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22252e]">
              {filteredExperiments.map((exp) => {
                const isSelected = selectedExpIds.includes(exp.id);
                return (
                  <tr
                    key={exp.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-[#221c1a]'
                        : 'hover:bg-[#191c23]'
                    }`}
                  >
                    <td className="py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(exp.id)}
                        className="rounded text-[#ff5500] focus:ring-0 cursor-pointer accent-[#ff5500]"
                      />
                    </td>
                    <td className="py-2 px-2.5">
                      <button
                        onClick={() => onNavigate('experiment_details', { experimentId: exp.id })}
                        className="hover:underline text-left block"
                      >
                        <div className="flex items-center gap-1.5">
                          <StBadge type="experiment" label={exp.id} />
                          <span className="font-semibold text-white text-xs">{exp.name}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Author: {exp.author} • Git: {exp.gitCommit}
                        </div>
                      </button>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="font-medium text-zinc-200 text-[11px]">{exp.datasetId}</div>
                      <StBadge type="version" label={exp.datasetVersion} className="text-[10px] py-0 mt-0.5" />
                    </td>
                    <td className="py-2 px-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        exp.mode === 'pipeline'
                          ? 'bg-[#261c28] text-purple-300 border border-purple-800/40'
                          : 'bg-[#1a1c24] text-zinc-300 border border-[#2b2e3a]'
                      }`}>
                        {exp.mode === 'pipeline' ? 'Pipeline Lab' : 'Existing RAG'}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-zinc-400 max-w-xs truncate text-[11px] font-mono">
                      {exp.configurationSummary}
                    </td>
                    <td className="py-2 px-2.5">
                      <StBadge type="status" label={exp.status} />
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-medium text-zinc-200">
                      {display(exp.metrics.recall10)}
                      {exp.deltas?.recall10 && (
                        <span className={`text-[10px] ml-1 font-normal ${exp.deltas.recall10 > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({exp.deltas.recall10 > 0 ? '+' : ''}{exp.deltas.recall10.toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-medium text-zinc-300">
                      {display(exp.metrics.ndcg10)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-400">
                      {display(exp.metrics.faithfulness)}
                      {exp.deltas?.faithfulness && (
                        <span className={`text-[10px] ml-1 font-normal ${exp.deltas.faithfulness > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({exp.deltas.faithfulness > 0 ? '+' : ''}{exp.deltas.faithfulness.toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-zinc-300">
                      {display(exp.metrics.answerRelevance)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-zinc-200">
                      {display(exp.metrics.avgLatency, 's')}
                      {exp.deltas?.avgLatency && (
                        <span className="text-[10px] text-rose-400 block font-normal">
                          (+{exp.deltas.avgLatency}s)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-zinc-400">
                      {Number.isFinite(exp.metrics.estimatedCost) ? `$${display(exp.metrics.estimatedCost)}` : 'Not recorded'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onNavigate('experiment_details', { experimentId: exp.id })}
                          className="px-2 py-0.5 rounded bg-[#1f222b] hover:bg-[#282c38] text-zinc-300 font-mono text-[10px] border border-[#2e323e] transition-colors"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => onNavigate('compare', { selected: [mockExperiments.find(item => item.id !== exp.id && item.status !== 'Draft')?.id, exp.id].filter(Boolean) })}
                          className="px-2 py-0.5 rounded bg-[#251e1b] hover:bg-[#332520] text-[#ff7733] font-mono text-[10px] border border-[#422720] transition-colors"
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
