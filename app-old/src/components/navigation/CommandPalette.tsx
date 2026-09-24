import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  BarChart3, 
  Database, 
  FlaskConical, 
  GitCompare, 
  Sliders, 
  Cpu, 
  Workflow, 
  ShieldCheck, 
  Settings, 
  FileText, 
  Play, 
  Sparkles, 
  ArrowRight,
  X
} from 'lucide-react';
import { ScreenId } from '../../types';
import { useRAGGauge } from '../../context/DataContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Screens' | 'Actions' | 'Edge Cases' | 'Tools';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { snapshot } = useRAGGauge();
  const runIds = snapshot.runs.slice(-2).map(run => run.id);
  const latestCase = snapshot.datasets[0]?.cases?.[0]?.id;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    {
      id: 'screen-overview',
      title: 'Overview Dashboard',
      category: 'Screens',
      description: 'Persisted run evidence, metric coverage, and workspace status',
      icon: BarChart3,
      badge: 'Main',
      action: () => onNavigate('overview')
    },
    {
      id: 'screen-experiments',
      title: 'Experiments Ledger',
      category: 'Screens',
      description: 'Run history, metric scores and multi-run selection',
      icon: FlaskConical,
      badge: `${snapshot.runs.length} runs`,
      action: () => onNavigate('experiments')
    },
    {
      id: 'screen-compare',
      title: 'Compare Experiments',
      category: 'Screens',
      description: 'Differential delta analysis between baseline & candidate runs',
      icon: GitCompare,
      badge: 'Diff',
      action: () => onNavigate('compare')
    },
    {
      id: 'screen-pipeline-lab',
      title: 'Pipeline Sandbox Lab',
      category: 'Screens',
      description: 'Tune chunk sizes, dense-sparse weights, reranking & sandbox query',
      icon: Sliders,
      badge: 'Interactive',
      action: () => onNavigate('pipeline_lab')
    },
    {
      id: 'screen-datasets',
      title: 'Datasets & Ground Truth',
      category: 'Screens',
      description: 'Manage golden query-context evaluation datasets & versions',
      icon: Database,
      badge: `${snapshot.datasets.length} sets`,
      action: () => onNavigate('datasets')
    },
    {
      id: 'screen-regression',
      title: 'Regression Analysis',
      category: 'Screens',
      description: 'Inspect persisted changed cases by deterministic diagnosis',
      icon: Sparkles,
      badge: 'Diagnosis',
      action: () => onNavigate('regression_analysis', { baselineId: runIds[0], currentId: runIds[1] })
    },
    {
      id: 'screen-recommendation',
      title: 'Recommendation & Production Gate',
      category: 'Screens',
      description: 'Inspect evidence-backed evaluated-run recommendations',
      icon: ShieldCheck,
      badge: 'Report',
      action: () => onNavigate('recommendation', { baselineId: runIds[0], currentId: runIds[1] })
    },
    {
      id: 'action-new-exp',
      title: 'Launch New Benchmark Run',
      category: 'Actions',
      description: 'Evaluate external Adapter or test Pipeline parameters',
      icon: Play,
      badge: 'Flow A',
      action: () => onNavigate('new_experiment')
    },
    {
      id: 'case-trace',
      title: latestCase ? `Inspect ${latestCase} trace` : 'Open Case Explorer',
      category: 'Edge Cases',
      description: 'Inspect the persisted normalized trace and metric evidence',
      icon: FileText,
      badge: 'Failure',
      action: () => onNavigate('case_detail', { caseId: latestCase })
    },
    {
      id: 'screen-models',
      title: 'Models & Judges Rubric',
      category: 'Screens',
      description: 'Configure GPT-4o, Claude 3.5 Sonnet & LLM-as-a-Judge thresholds',
      icon: Cpu,
      action: () => onNavigate('models_judges')
    },
    {
      id: 'screen-adapters',
      title: 'HTTP & Framework Adapters',
      category: 'Screens',
      description: 'Connect REST endpoints, LangChain & LlamaIndex pipelines',
      icon: Workflow,
      action: () => onNavigate('adapters')
    },
    {
      id: 'screen-settings',
      title: 'Workspace Settings & Guardrails',
      category: 'Screens',
      description: 'SLA latency thresholds, API keys and export configuration',
      icon: Settings,
      action: () => onNavigate('settings')
    }
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-5 h-5 text-indigo-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, screen, or case ID (e.g. 'Lab', 'CASE-031', 'Compare')..."
            className="w-full bg-transparent border-none outline-hidden text-sm text-white placeholder-slate-500 font-sans"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 rounded text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No matching commands or screens found for <span className="text-slate-300">"{query}"</span>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' 
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-indigo-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        {cmd.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-indigo-100' : 'text-slate-400'
                      }`}>
                        {cmd.description}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 shrink-0 ml-2 transition-transform ${
                    isSelected ? 'translate-x-0.5 opacity-100 text-white' : 'opacity-0'
                  }`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">↑↓</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">↵</kbd> select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">esc</kbd> close</span>
          </div>
          <div className="text-indigo-400 font-medium">
            RAGGauge v0.1.0
          </div>
        </div>
      </div>
    </div>
  );
};
