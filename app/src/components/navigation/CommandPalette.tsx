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
  X,
  Code2,
  LogIn,
  Gauge
} from 'lucide-react';
import { useRAGGauge } from '../../context/DataContext';
import { ScreenId } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
  onOpenCodeModal: () => void;
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
  onOpenCodeModal
}) => {
  const { snapshot } = useRAGGauge();
  const latestComparison = [...snapshot.comparisons].reverse()[0];
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
      description: 'System health metrics, Pareto frontier & engineering ledger',
      icon: BarChart3,
      badge: 'Main',
      action: () => onNavigate('overview')
    },
    {
      id: 'screen-compact-console',
      title: 'Demo Dashboard (Compact Hardware UI)',
      category: 'Screens',
      description: 'Compact telemetry console with tactile dials, knobs & LED matrix displays',
      icon: Gauge,
      badge: 'Compact',
      action: () => onNavigate('compact_console')
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
      title: 'Latest Regression Analysis',
      category: 'Screens',
      description: 'Inspect persisted stage evidence and affected cases',
      icon: Sparkles,
      badge: 'Diagnosis',
      action: () => onNavigate('regression_analysis', { baselineId: latestComparison?.baseline_run_id, currentId: latestComparison?.candidate_run_id })
    },
    {
      id: 'screen-recommendation',
      title: 'Recommendation & Production Gate',
      category: 'Screens',
      description: 'Evidence-backed controlled next experiments',
      icon: ShieldCheck,
      badge: 'Report',
      action: () => onNavigate('recommendation', { baselineId: latestComparison?.baseline_run_id, currentId: latestComparison?.candidate_run_id })
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
      id: 'action-login',
      title: 'Login Page / Switch Engineer Profile',
      category: 'Actions',
      description: 'Sign out to change the local account',
      icon: LogIn,
      badge: 'Auth',
      action: () => onNavigate('login')
    },
    {
      id: 'case-031',
      title: 'Inspect a persisted case',
      category: 'Edge Cases',
      description: 'Inspect the latest available normalized trace',
      icon: FileText,
      badge: 'Failure',
      action: () => onNavigate('case_detail', {})
    },
    {
      id: 'action-code',
      title: 'Inspect Streamlit Python Source',
      category: 'Tools',
      description: 'View pure Streamlit st.metric, st.dataframe, st.tabs implementation',
      icon: Code2,
      badge: 'Python',
      action: onOpenCodeModal
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

  const filteredCommands = commands.filter(cmd => !['screen-compact-console', 'action-code', 'action-login'].includes(cmd.id)).filter(cmd =>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#15171e] border border-[#272a33] rounded-xl shadow-2xl overflow-hidden flex flex-col text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#22252c] bg-[#12141a]">
          <Search className="w-5 h-5 text-[#ff5500] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, screen, or case ID (e.g. 'Lab', 'CASE-031', 'Compare')..."
            className="w-full bg-transparent border-none outline-hidden text-sm text-white placeholder-zinc-500 font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 rounded text-[10px] font-mono text-zinc-400 bg-[#1e2129] border border-[#2e323e]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No matching commands or screens found for <span className="text-zinc-300">"{query}"</span>
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-[#ff5500] text-white shadow-xs shadow-orange-500/30'
                      : 'text-zinc-300 hover:bg-[#1d2027] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-[#1e2129] text-[#ff7733]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        {cmd.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSelected ? 'bg-[#e04b00] text-white' : 'bg-[#191b22] text-zinc-400 border border-[#2b2e38]'
                          }`}>
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-white/80' : 'text-zinc-400'
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
        <div className="px-4 py-2 bg-[#101217] border-t border-[#22252c] text-[11px] text-zinc-400 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#1e2129] text-zinc-300 border border-[#2b2e38]">↑↓</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#1e2129] text-zinc-300 border border-[#2b2e38]">↵</kbd> select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#1e2129] text-zinc-300 border border-[#2b2e38]">esc</kbd> close</span>
          </div>
          <div className="text-[#ff7733] font-medium">
            RAGGauge v1.4.2
          </div>
        </div>
      </div>
    </div>
  );
};
