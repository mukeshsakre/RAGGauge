import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  ChevronRight
} from 'lucide-react';
import { StBadge, StButton } from '../components/ui/StreamlitComponents';
import { mockDatasets } from '../mockData';
import { ScreenId } from '../types';

interface DatasetsScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const DatasetsScreen: React.FC<DatasetsScreenProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredDatasets = mockDatasets.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header Description & Stats */}
      <div className="bg-[#15171e] rounded-xl border border-[#272a33] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#221c1a] text-[#ff7733] border border-[#3e2720]">
                <Database className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white font-mono">Evaluation Datasets</h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#1e2129] text-zinc-300 border border-[#2c303c]">
                {mockDatasets.length} Suites
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Immutable versioned test suites containing golden ground-truth answers and expected document chunk citations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StButton
              id="btn-create-dataset"
              label="Create Dataset"
              icon={<Plus className="w-3.5 h-3.5" />}
              variant="primary"
              size="sm"
              onClick={() => onNavigate('create_dataset')}
            />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-[#15171e] p-2.5 rounded-xl border border-[#272a33] flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search datasets by name, tags, domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#191b22] border border-[#272a33] rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-hidden focus:border-[#ff5500] transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#191b22] border border-[#272a33] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-[#ff5500] transition-all cursor-pointer font-mono"
            >
              <option value="All">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Validation Issues">Validation Issues</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="text-zinc-400 text-[11px] font-mono">
          Showing <span className="text-zinc-200 font-bold">{filteredDatasets.length}</span> of {mockDatasets.length} datasets
        </div>
      </div>

      {/* Main Datasets Table */}
      <div className="bg-[#15171e] rounded-xl border border-[#272a33] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#181b22] border-b border-[#272a33] text-zinc-400 font-semibold font-mono text-[11px]">
                <th className="py-2 px-3">Dataset Name</th>
                <th className="py-2 px-2.5">Current Version</th>
                <th className="py-2 px-2.5">Available Versions</th>
                <th className="py-2 px-2.5 text-right">Golden Cases</th>
                <th className="py-2 px-2.5">Last Modified</th>
                <th className="py-2 px-2.5 text-right">Linked Experiments</th>
                <th className="py-2 px-2.5">Validation Status</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22252e]">
              {filteredDatasets.map((ds) => (
                <tr 
                  key={ds.id} 
                  className="hover:bg-[#191c23] transition-colors cursor-pointer group"
                  onClick={() => onNavigate('dataset_detail', { datasetId: ds.id })}
                >
                  <td className="py-2.5 px-3 font-medium text-zinc-100">
                    <div className="font-bold text-white group-hover:text-[#ff7733] group-hover:underline flex items-center gap-1.5 font-mono text-xs transition-colors">
                      <Database className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{ds.name}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans">
                      {ds.description}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5">
                    <StBadge type="version" label={ds.currentVersion} />
                  </td>
                  <td className="py-2.5 px-2.5">
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {ds.versions.join(', ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-bold text-zinc-200">
                    {ds.casesCount}
                  </td>
                  <td className="py-2.5 px-2.5 text-zinc-400 font-mono text-[11px]">
                    {ds.lastModified}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-zinc-300">
                    {ds.experimentsCount} runs
                  </td>
                  <td className="py-2.5 px-2.5">
                    <StBadge type="status" label={ds.status} />
                  </td>
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onNavigate('dataset_detail', { datasetId: ds.id })}
                        className="px-2 py-0.5 rounded bg-[#1f222b] hover:bg-[#282c38] text-zinc-300 font-mono text-[10px] border border-[#2e323e] transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onNavigate('new_experiment', { datasetId: ds.id })}
                        className="px-2 py-0.5 rounded bg-[#251e1b] hover:bg-[#332520] text-[#ff7733] font-mono text-[10px] border border-[#422720] transition-colors"
                      >
                        Run Eval
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
