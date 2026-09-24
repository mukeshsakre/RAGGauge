import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  FlaskConical, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Download
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
    <div className="space-y-6">
      {/* Header Description & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Evaluation Datasets</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable versioned test suites containing golden ground-truth answers and expected document chunk citations.
          </p>
        </div>
        <StButton
          id="btn-create-dataset"
          label="Create Dataset"
          icon={<Plus className="w-4 h-4" />}
          variant="primary"
          onClick={() => onNavigate('create_dataset')}
        />
      </div>

      {/* Filter Row */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search datasets by name or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:outline-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Ready">Ready</option>
              <option value="Validation Issues">Validation Issues</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500 text-xs font-mono">
          Showing {filteredDatasets.length} of {mockDatasets.length} datasets
        </div>
      </div>

      {/* Main Datasets Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Dataset Name</th>
                <th className="py-3 px-3">Current Version</th>
                <th className="py-3 px-3">Versions</th>
                <th className="py-3 px-3 text-right">Cases</th>
                <th className="py-3 px-3">Last Modified</th>
                <th className="py-3 px-3 text-right">Experiments</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDatasets.map((ds) => (
                <tr 
                  key={ds.id} 
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  onClick={() => onNavigate('dataset_detail', { datasetId: ds.id })}
                >
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    <div className="font-semibold text-indigo-700 group-hover:underline flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ds.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {ds.description}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <StBadge type="version" label={ds.currentVersion} />
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-mono text-slate-600 text-[11px]">
                      {ds.versions.join(', ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                    {ds.casesCount}
                  </td>
                  <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                    {ds.lastModified}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                    {ds.experimentsCount}
                  </td>
                  <td className="py-3.5 px-3">
                    <StBadge type="status" label={ds.status} />
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onNavigate('dataset_detail', { datasetId: ds.id })}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onNavigate('new_experiment', { datasetId: ds.id })}
                        className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium"
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
