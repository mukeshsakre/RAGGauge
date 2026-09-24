import React, { useState } from 'react';
import { 
  Search, 
  Activity, 
  Gauge, 
  CheckCircle2, 
  Sliders, 
  Zap, 
  RotateCw, 
  Aperture, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  ChevronDown, 
  ChevronRight,
  Power,
  BarChart3,
  Database,
  FlaskConical,
  GitCompare,
  Cpu,
  Settings,
  Code2,
  RefreshCw,
  LogOut,
  Layers,
  Sparkles,
  Play
} from 'lucide-react';
import { RotaryKnob } from '../components/compact/RotaryKnob';
import { ArcGaugeKnob, EffortLevel } from '../components/compact/ArcGaugeKnob';
import { TactileButton } from '../components/compact/TactileButton';
import { OpModeSelector } from '../components/compact/OpModeSelector';
import { DigitalLedClock } from '../components/compact/DigitalLedClock';
import { ChamberPressureGraph } from '../components/compact/ChamberPressureGraph';
import { StreamlitCodeModal } from '../components/modals/StreamlitCodeModal';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { soundFx } from '../utils/haptics';
import { ScreenId } from '../types';

interface CompactConsoleScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const CompactConsoleScreen: React.FC<CompactConsoleScreenProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const isDark = theme === 'dark';

  // Navigation menu options matching previous version
  const menuOptions = [
    { id: 'overview' as ScreenId, label: 'Overview', icon: BarChart3 },
    { id: 'datasets' as ScreenId, label: 'Datasets', icon: Database, badge: '8' },
    { id: 'experiments' as ScreenId, label: 'Experiments', icon: FlaskConical, badge: '126' },
    { id: 'compare' as ScreenId, label: 'Compare Runs', icon: GitCompare, badge: 'Diff' },
    { id: 'pipeline_lab' as ScreenId, label: 'Pipeline Lab', icon: Sliders, badge: 'Sandbox' },
    { id: 'case_detail' as ScreenId, label: 'Case Explorer', icon: Search },
    { id: 'models_judges' as ScreenId, label: 'Models & Judges', icon: Cpu },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings },
  ];

  // Project switcher from previous version
  const projects = [
    { id: 'p1', name: 'Customer Support Prod v3.2', cases: 150, target: 'p95 < 1500ms' },
    { id: 'p2', name: 'Financial 10-K Compliance', cases: 320, target: 'Faithfulness > 0.92' },
    { id: 'p3', name: 'Internal Knowledge Base', cases: 85, target: 'Recall@10 > 0.88' },
    { id: 'p4', name: 'Product Recommendation Bot', cases: 210, target: 'Hybrid α = 0.65' },
  ];
  const [activeProject, setActiveProject] = useState('Customer Support Prod v3.2');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  // Search and Tree state
  const [searchTerm, setSearchTerm] = useState('');
  const [telemetryExpanded, setTelemetryExpanded] = useState(true);
  const [suitesExpanded, setSuitesExpanded] = useState(false);
  const [workersExpanded, setWorkersExpanded] = useState(false);
  const [selectedParam, setSelectedParam] = useState<string>('faithfulness');

  // Interactive hardware states - all fonts unified to font-mono
  const [latencyBudget, setLatencyBudget] = useState<number>(800);
  const [hybridAlphaSetpoint, setHybridAlphaSetpoint] = useState<number>(450);
  const [evalMode, setEvalMode] = useState<string>('BENCHMARK');
  const [rigorEffort, setRigorEffort] = useState<EffortLevel>('MEDIUM');
  const [judgeEnabled, setJudgeEnabled] = useState<boolean>(true);
  const [rerankerActive, setRerankerActive] = useState<boolean>(true);
  const [semanticCacheActive, setSemanticCacheActive] = useState<boolean>(true);
  const [crossEncoderActive, setCrossEncoderActive] = useState<boolean>(false);
  const [workerPoolActive, setWorkerPoolActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setEnabled(next);
  };

  const handleRefresh = () => {
    soundFx.click('press');
    showToast({
      type: 'info',
      title: 'Syncing telemetry...',
      message: 'Fetching fresh evaluation traces from cluster workers.'
    });
    setTimeout(() => {
      showToast({
        type: 'success',
        title: 'Telemetry Synced',
        message: 'All 150 benchmark test cases updated.'
      });
    }, 400);
  };

  // Evaluation telemetry items matching previous version's labels and metrics
  const telemetryParams = [
    { id: 'faithfulness', name: 'faithfulness', value: '0.892 (89.2%)', icon: Activity, type: 'metric' },
    { id: 'recall10', name: 'recall@10', value: '0.941 (94.1%)', icon: Gauge, type: 'metric' },
    { id: 'ndcg10', name: 'ndcg@10', value: '0.876', icon: Activity, type: 'metric' },
    { id: 'avg_latency', name: 'avg_latency', value: '412 ms', isSpecial: true, type: 'metric' },
    { id: 'p95_latency', name: 'p95_latency', value: '1,180 ms', icon: Gauge, type: 'metric' },
    { id: 'cost_per_1k', name: 'cost_per_1k', value: '$0.0034', icon: Activity, type: 'metric' },
    { id: 'context_precision', name: 'context_precision', value: '0.915', icon: Activity, type: 'metric' },
    { id: 'context_recall', name: 'context_recall', value: '0.938', icon: Gauge, type: 'metric' },
    { id: 'chunk_size', name: 'chunk_size', value: '512 tokens', icon: Sliders, type: 'metric' },
    { id: 'chunk_overlap', name: 'chunk_overlap', value: '64 tokens', icon: Sliders, type: 'metric' },
    { id: 'hybrid_alpha', name: 'hybrid_alpha', value: '0.65 (dense)', icon: CheckCircle2, type: 'status' },
    { id: 'top_k', name: 'top_k_candidates', value: '25', icon: CheckCircle2, type: 'status' },
    { id: 'rerank_cutoff', name: 'rerank_cutoff', value: '0.72', icon: CheckCircle2, type: 'status' },
    { id: 'eval_rigor', name: 'eval_rigor', value: 'STRICT', icon: Sliders, type: 'status' },
    { id: 'judge_model', name: 'judge_model', value: 'gemini-2.5-flash', icon: Activity, type: 'metric' },
    { id: 'cluster_workers', name: 'cluster_workers', value: '4/4 ACTIVE', icon: CheckCircle2, type: 'status' },
  ];

  const filteredParams = telemetryParams.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      className={`min-h-screen w-full flex items-center justify-center p-2 sm:p-5 select-none transition-colors duration-200 ${
        isDark 
          ? 'bg-[#3b3c3e]' 
          : 'bg-[#d8d9de]'
      }`}
      style={{
        background: isDark
          ? 'radial-gradient(circle at 50% 35%, #4a4b4e 0%, #353638 50%, #222325 100%)'
          : 'radial-gradient(circle at 50% 35%, #edf0f5 0%, #d8dae0 50%, #c4c6cd 100%)'
      }}
    >
      {/* Precision Instrument Console Window */}
      <div 
        className={`w-full max-w-[1300px] rounded-xl overflow-hidden border shadow-2xl transition-colors duration-200 flex flex-col ${
          isDark 
            ? 'bg-[#262626] border-[#1b1b1b] shadow-[0_20px_50px_rgba(0,0,0,0.85)]' 
            : 'bg-[#f4f5f7] border-[#d4d5db] shadow-[0_20px_50px_rgba(0,0,0,0.18)]'
        }`}
      >
        {/* macOS Style Title Bar matching screenshot */}
        <div 
          className={`h-11 px-4 flex items-center justify-between border-b relative select-none ${
            isDark 
              ? 'bg-[#242424] border-[#1b1b1b] text-[#d1d5db]' 
              : 'bg-[#eceef2] border-[#d8d9de] text-[#333333]'
          }`}
        >
          {/* Left: Window Dots + Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate('overview')}
                className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] hover:brightness-110 active:brightness-90 transition-all cursor-pointer"
                title="Return to Overview"
              />
              <button 
                onClick={() => {
                  setLatencyBudget(800);
                  setHybridAlphaSetpoint(450);
                  setRigorEffort('MEDIUM');
                  setEvalMode('BENCHMARK');
                  showToast({ type: 'info', title: 'Parameters Reset', message: 'Tuning values returned to baseline.' });
                }}
                className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] hover:brightness-110 active:brightness-90 transition-all cursor-pointer"
                title="Reset Setpoints"
              />
              <button 
                onClick={() => onNavigate('overview')}
                className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] hover:brightness-110 active:brightness-90 transition-all cursor-pointer"
                title="Overview Studio"
              />
            </div>

            <div 
              onClick={() => onNavigate('overview')}
              className="flex items-center gap-2 cursor-pointer ml-1"
            >
              <div className="w-5 h-5 rounded-md bg-[#ff5500] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Zap className="w-3 h-3 fill-white text-white" />
              </div>
              <span className="font-mono font-bold text-xs tracking-wider text-inherit">
                RAGGUAGE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-[#ff5500] border border-orange-500/20 font-semibold hidden sm:inline">
                CONSOLE
              </span>
            </div>

            {/* Project Switcher Dropdown from previous version */}
            <div className="relative hidden lg:block ml-2">
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                  isDark 
                    ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300' 
                    : 'border-zinc-300 bg-white/70 hover:bg-white text-zinc-800'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[180px]">{activeProject}</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {projectDropdownOpen && (
                <div 
                  className={`absolute left-0 mt-1 w-64 border rounded-lg shadow-xl py-1 z-50 text-xs font-mono animate-in fade-in duration-100 ${
                    isDark ? 'bg-[#1e1e1e] border-zinc-800' : 'bg-white border-zinc-300'
                  }`}
                  onClick={() => setProjectDropdownOpen(false)}
                >
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Benchmark Suites
                  </div>
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setActiveProject(proj.name);
                        showToast({
                          type: 'info',
                          title: 'Benchmark Suite Switched',
                          message: `Loaded ${proj.name} (${proj.cases} test cases)`
                        });
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                        activeProject === proj.name 
                          ? isDark ? 'bg-zinc-800 text-[#ff5500] font-bold' : 'bg-orange-50 text-[#ff5500] font-bold'
                          : isDark ? 'text-zinc-300 hover:bg-zinc-800/60' : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <div>
                        <div className="truncate">{proj.name}</div>
                        <div className="text-[10px] text-zinc-400">{proj.cases} cases • {proj.target}</div>
                      </div>
                      {activeProject === proj.name && <CheckCircle2 className="w-3.5 h-3.5 text-[#ff5500] shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center: Title */}
          <div className="font-mono text-xs font-semibold tracking-wider flex items-center gap-2">
            <span>EXP-1042</span>
            <span className="text-zinc-400 font-normal hidden md:inline">|</span>
            <span className="text-emerald-500 hidden md:inline">CANDIDATE NOMINAL</span>
          </div>

          {/* Right: Quick actions + Theme & Sound Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Sync Cluster Telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsCodeModalOpen(true)}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Inspect Streamlit Python Implementation"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleSound}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
              title={soundEnabled ? 'Mute Mechanical Haptics' : 'Enable Mechanical Haptics'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
            </button>

            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-amber-400 hover:text-amber-300' : 'hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* User Profile */}
            <div className="relative ml-1">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border transition-colors ${
                  isDark ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300' : 'border-zinc-300 bg-white/70 hover:bg-white text-zinc-700'
                }`}
              >
                <div className="w-4 h-4 rounded bg-[#ff5500] text-white flex items-center justify-center font-bold text-[9px]">
                  {user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'MS'}
                </div>
                <span className="hidden sm:inline text-[11px] truncate max-w-[80px]">
                  {user ? user.name.split(' ')[0] : 'Mukesh'}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {userDropdownOpen && (
                <div 
                  className={`absolute right-0 mt-1 w-56 border rounded-lg shadow-xl py-1 z-50 text-xs font-mono animate-in fade-in duration-100 ${
                    isDark ? 'bg-[#1e1e1e] border-zinc-800 text-zinc-300' : 'bg-white border-zinc-300 text-zinc-700'
                  }`}
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-zinc-700/50">
                    <div className="font-bold text-inherit">{user?.name || 'Mukesh Sakre'}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{user?.email || 'mukeshsakre.85@gmail.com'}</div>
                  </div>
                  <button
                    onClick={() => onNavigate('login')}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Switch Engineer</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      onNavigate('login');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Menu Options Bar matching previous version */}
        <div 
          className={`px-4 py-2 border-b flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono select-none ${
            isDark 
              ? 'bg-[#1f1f1f] border-[#1c1c1c] text-[#a0a0a0]' 
              : 'bg-[#e7e9ed] border-[#d8d9de] text-[#555555]'
          }`}
        >
          {/* Menu Options Links */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {menuOptions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    isDark 
                      ? 'hover:bg-[#2c2c2c] hover:text-white' 
                      : 'hover:bg-[#d8dae0] hover:text-zinc-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-[#ff5500]" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-500/20 text-zinc-400 font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Action Buttons from previous version */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('new_experiment')}
              className="px-2.5 py-1 rounded bg-[#ff5500] hover:bg-[#e04b00] active:bg-[#c94200] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>+ New Eval</span>
            </button>

            <button
              onClick={() => onNavigate('compare', { selected: ['EXP-1041', 'EXP-1042'] })}
              className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark 
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' 
                  : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
              }`}
            >
              <GitCompare className="w-3 h-3 text-[#ff5500]" />
              <span className="hidden sm:inline">Compare Baseline</span>
            </button>
          </div>
        </div>

        {/* Main Workstation Layout: Left Telemetry Tree + Right 4-Column Grid */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Sidebar (~260px wide) - All fonts strictly font-mono */}
          <div 
            className={`w-full md:w-[260px] shrink-0 border-b md:border-b-0 md:border-r flex flex-col font-mono transition-colors ${
              isDark 
                ? 'bg-[#262626] border-[#1c1c1c]' 
                : 'bg-[#f4f5f7] border-[#d8d9de]'
            }`}
          >
            {/* Search Pill Input matching screenshot */}
            <div className={`p-2.5 border-b ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
              <div 
                className={`flex items-center gap-2 px-2.5 py-1 rounded border text-xs transition-colors ${
                  isDark 
                    ? 'bg-[#1e1e1e] border-[#383838] text-[#d4d4d8] focus-within:border-[#ff5500]' 
                    : 'bg-white border-[#cfd1d8] text-[#222222] focus-within:border-[#ff5500]'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search telemetry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none outline-none font-mono text-xs placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Tree Navigation: All text uses the exact font of the left panel */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px]">
              
              {/* ▼ EVALUATION TELEMETRY Section (EXP-1042) */}
              <div>
                <button
                  type="button"
                  onClick={() => setTelemetryExpanded(!telemetryExpanded)}
                  className={`w-full flex items-center gap-1.5 py-1 px-1 text-left font-bold tracking-wider text-[11px] uppercase transition-colors ${
                    isDark ? 'text-[#e5e5e5] hover:text-white' : 'text-[#333333] hover:text-black'
                  }`}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${telemetryExpanded ? '' : '-rotate-90'}`} />
                  <span>EVALUATION TELEMETRY</span>
                </button>

                {telemetryExpanded && (
                  <div className="pl-2 space-y-0.5 mt-0.5">
                    {filteredParams.map((param) => {
                      const isSelected = selectedParam === param.id;
                      const isHighlightRow = param.isSpecial;

                      return (
                        <div
                          key={param.id}
                          onClick={() => {
                            setSelectedParam(param.id);
                            soundFx.click('press');
                          }}
                          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors ${
                            isSelected
                              ? isDark 
                                ? 'bg-[#383838] text-white font-bold' 
                                : 'bg-[#e2e4e9] text-zinc-950 font-bold'
                              : isHighlightRow
                                ? 'bg-[#ff5500] text-white font-bold'
                                : isDark
                                  ? 'text-[#9e9e9e] hover:bg-[#2c2c2c] hover:text-[#d4d4d8]'
                                  : 'text-zinc-500 hover:bg-[#e9ebf0] hover:text-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            {param.icon && <param.icon className="w-3 h-3 shrink-0 opacity-70" />}
                            <span className="truncate">{param.name}</span>
                          </div>
                          <span className={`text-[10px] shrink-0 font-medium ${
                            isHighlightRow ? 'text-white' : isSelected ? 'text-[#ff5500]' : ''
                          }`}>
                            {param.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ▶ BENCHMARK SUITES Collapsible Section */}
              <div className="pt-2 border-t border-zinc-500/10">
                <button
                  type="button"
                  onClick={() => setSuitesExpanded(!suitesExpanded)}
                  className={`w-full flex items-center gap-1.5 py-1 px-1 text-left font-bold tracking-wider text-[11px] uppercase transition-colors ${
                    isDark ? 'text-[#9e9e9e] hover:text-[#e5e5e5]' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${suitesExpanded ? 'rotate-90' : ''}`} />
                  <span>BENCHMARK SUITES (4)</span>
                </button>

                {suitesExpanded && (
                  <div className="pl-2 space-y-1 mt-1 text-[10px]">
                    {projects.map((proj) => (
                      <div 
                        key={proj.id}
                        onClick={() => {
                          setActiveProject(proj.name);
                          soundFx.click('press');
                        }}
                        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer ${
                          activeProject === proj.name
                            ? isDark ? 'bg-[#333333] text-white font-bold' : 'bg-[#e2e4e9] text-zinc-950 font-bold'
                            : isDark ? 'text-zinc-400 hover:bg-[#2c2c2c]' : 'text-zinc-600 hover:bg-[#e9ebf0]'
                        }`}
                      >
                        <span className="truncate">{proj.name}</span>
                        <span className="text-[#ff5500]">{proj.cases}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ▶ CLUSTER WORKERS Collapsible Section */}
              <div className="pt-2 border-t border-zinc-500/10">
                <button
                  type="button"
                  onClick={() => setWorkersExpanded(!workersExpanded)}
                  className={`w-full flex items-center gap-1.5 py-1 px-1 text-left font-bold tracking-wider text-[11px] uppercase transition-colors ${
                    isDark ? 'text-[#9e9e9e] hover:text-[#e5e5e5]' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${workersExpanded ? 'rotate-90' : ''}`} />
                  <span>CLUSTER WORKERS (4)</span>
                </button>

                {workersExpanded && (
                  <div className="pl-2 space-y-1 mt-1 text-[10px] text-zinc-400">
                    <div className="flex justify-between py-0.5 px-2">
                      <span>worker-us-east-1</span>
                      <span className="text-emerald-500 font-bold">READY</span>
                    </div>
                    <div className="flex justify-between py-0.5 px-2">
                      <span>worker-us-east-2</span>
                      <span className="text-emerald-500 font-bold">READY</span>
                    </div>
                    <div className="flex justify-between py-0.5 px-2">
                      <span>judge-evaluator-pool</span>
                      <span className="text-emerald-500 font-bold">READY</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Left Sidebar Footer: System Status */}
            <div className={`p-2.5 border-t text-[10px] font-mono flex items-center justify-between ${
              isDark ? 'border-[#1c1c1c] text-[#737373]' : 'border-[#d8d9de] text-[#8e8e93]'
            }`}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-zinc-300 dark:text-zinc-300">BENCHMARK ACTIVE</span>
              </div>
              <span className="text-zinc-400">150 CASES</span>
            </div>

          </div>

          {/* Right Modular Controls - Strict 4 Continuous Columns */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 font-mono">
            
            {/* ================= COLUMN 1 ================= */}
            <div className={`flex flex-col border-b md:border-b-0 md:border-r ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
              
              {/* Row 1, Col 1: Telemetry Response Curve */}
              <div className={`h-[210px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide flex items-center justify-between">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Quality / Latency response</span>
                  <span className="text-[10px] text-[#ff5500] font-bold">+6.5% Q</span>
                </div>
                <div className="flex-1 w-full flex items-center justify-center">
                  <ChamberPressureGraph isDark={isDark} />
                </div>
              </div>

              {/* Row 2, Col 1: Latency Budget Setpoint Knob */}
              <div className={`h-[250px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Latency budget</span>
                </div>

                {/* Readout in pure font-mono matching left panel */}
                <div 
                  className={`font-mono text-center text-2xl font-bold tracking-wider mt-1 ${isDark ? 'text-[#e5e5e5]' : 'text-[#1e1e1e]'}`}
                >
                  {latencyBudget} <span className="text-base font-normal">ms</span>
                </div>

                {/* Rotary Knob */}
                <div className="flex-1 flex items-center justify-center">
                  <RotaryKnob
                    value={latencyBudget}
                    min={200}
                    max={2000}
                    step={25}
                    size={110}
                    onChange={setLatencyBudget}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Row 3, Col 1: Target P95 Latency */}
              <div className={`p-3 flex flex-col justify-center ${isDark ? 'bg-[#262626]' : 'bg-[#f4f5f7]'}`}>
                <div className={`text-xs ${isDark ? 'text-[#8e8e93]' : 'text-[#64748b]'}`}>
                  Target p95 latency
                </div>
                <div className={`font-mono text-sm mt-1 font-bold ${isDark ? 'text-[#d4d4d8]' : 'text-[#18181b]'}`}>
                  1,180 <span className="font-normal text-xs opacity-70">ms (SLA &lt; 1500)</span>
                </div>
              </div>

            </div>


            {/* ================= COLUMN 2 ================= */}
            <div className={`flex flex-col border-b md:border-b-0 md:border-r ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
              
              {/* Row 1, Col 2: Run time with 11:07 LED & Tick bars */}
              <div className={`h-[210px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Run time</span>
                </div>
                <div className="flex-1 w-full flex items-center justify-center">
                  <DigitalLedClock isDark={isDark} />
                </div>
              </div>

              {/* Row 2, Col 2: Op mode Selector with Monospace Font */}
              <div className={`h-[250px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Op mode</span>
                </div>
                <div className="flex-1 w-full flex items-center justify-center">
                  <OpModeSelector 
                    currentMode={evalMode}
                    onSelectMode={setEvalMode}
                    modes={['BENCHMARK', 'REGRESSION', 'DIAGNOSTIC', 'SANDBOX', 'AUTO-EVAL']}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Row 3, Col 2: Error rate */}
              <div className={`p-3 flex flex-col justify-center ${isDark ? 'bg-[#262626]' : 'bg-[#f4f5f7]'}`}>
                <div className={`text-xs ${isDark ? 'text-[#8e8e93]' : 'text-[#64748b]'}`}>
                  Error rate
                </div>
                <div className="font-mono text-sm mt-1 font-bold text-emerald-500">
                  0.00% <span className="font-normal text-xs opacity-70">(0 / 150 failed)</span>
                </div>
              </div>

            </div>


            {/* ================= COLUMN 3 ================= */}
            <div className={`flex flex-col border-b md:border-b-0 md:border-r ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
              
              {/* Row 1, Col 3: Judge LLM + Reranker + Semantic Cache */}
              <div className={`h-[210px] flex flex-col border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                
                {/* Upper: Judge LLM */}
                <div className={`flex-1 p-2.5 flex flex-col justify-between border-b ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Judge LLM</span>
                    <span className={`font-mono text-xs font-bold ${judgeEnabled ? 'text-[#ff5500]' : 'text-zinc-400'}`}>
                      {judgeEnabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex items-center justify-center py-1">
                    <TactileButton 
                      active={judgeEnabled}
                      onClick={() => setJudgeEnabled(!judgeEnabled)}
                      icon={<Zap className="w-5 h-5 fill-current" />}
                      size="md"
                      isDark={isDark}
                    />
                  </div>
                </div>

                {/* Lower: Reranker + Semantic Cache */}
                <div className="h-[90px] grid grid-cols-2">
                  
                  {/* Reranker */}
                  <div className={`p-2 flex flex-col justify-between border-r ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Reranker</span>
                      <span className="font-mono text-[10px] text-zinc-400">{rerankerActive ? 'ON' : 'BYPASS'}</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <TactileButton 
                        active={rerankerActive}
                        onClick={() => setRerankerActive(!rerankerActive)}
                        icon={<Aperture className="w-4 h-4" />}
                        size="sm"
                        isDark={isDark}
                      />
                    </div>
                  </div>

                  {/* Semantic Cache */}
                  <div className="p-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Cache</span>
                      <span className={`font-mono text-[10px] font-bold ${semanticCacheActive ? 'text-[#ff5500]' : 'text-zinc-400'}`}>
                        {semanticCacheActive ? 'HIT 84%' : 'OFF'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <TactileButton 
                        active={semanticCacheActive}
                        onClick={() => setSemanticCacheActive(!semanticCacheActive)}
                        icon={<Layers className="w-4 h-4" />}
                        size="sm"
                        isDark={isDark}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2, Col 3: Evaluation Rigor with ArcGaugeKnob */}
              <div className={`h-[250px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Evaluation rigor</span>
                </div>

                {/* Readout in pure font-mono */}
                <div 
                  className={`font-mono text-center text-xl font-bold tracking-wider mt-1 ${isDark ? 'text-[#e5e5e5]' : 'text-[#1e1e1e]'}`}
                >
                  {rigorEffort}
                </div>

                {/* Arc Gauge Knob */}
                <div className="flex-1 flex items-center justify-center">
                  <ArcGaugeKnob 
                    level={rigorEffort}
                    onChange={setRigorEffort}
                    size={110}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Row 3, Col 3: Judge model */}
              <div className={`p-3 flex flex-col justify-center ${isDark ? 'bg-[#262626]' : 'bg-[#f4f5f7]'}`}>
                <div className={`text-xs ${isDark ? 'text-[#8e8e93]' : 'text-[#64748b]'}`}>
                  Judge model
                </div>
                <div className={`font-mono text-sm mt-1 font-bold ${isDark ? 'text-[#d4d4d8]' : 'text-[#18181b]'}`}>
                  GEMINI-2.5-FLASH
                </div>
              </div>

            </div>


            {/* ================= COLUMN 4 ================= */}
            <div className="flex flex-col">
              
              {/* Row 1, Col 4: Cross-Encoder + Worker Pool */}
              <div className={`h-[210px] flex flex-col border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                
                {/* Upper: Cross-Encoder */}
                <div className={`flex-1 p-2.5 flex flex-col justify-between border-b ${isDark ? 'border-[#1c1c1c]' : 'border-[#d8d9de]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Cross-encoder</span>
                    <span className={`font-mono text-xs font-bold ${crossEncoderActive ? 'text-[#ff5500]' : 'text-zinc-400'}`}>
                      {crossEncoderActive ? 'ON' : 'BYPASS'}
                    </span>
                  </div>
                  <div className="flex items-center justify-center py-1">
                    <TactileButton 
                      active={crossEncoderActive}
                      onClick={() => setCrossEncoderActive(!crossEncoderActive)}
                      icon={<Power className="w-5 h-5" />}
                      size="md"
                      isDark={isDark}
                    />
                  </div>
                </div>

                {/* Lower: Worker Pool */}
                <div className="h-[90px] p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Worker pool</span>
                    <span className={`font-mono text-[10px] font-bold ${workerPoolActive ? 'text-[#ff5500]' : 'text-zinc-400'}`}>
                      {workerPoolActive ? '4 ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex items-center justify-center">
                    <TactileButton 
                      active={workerPoolActive}
                      onClick={() => setWorkerPoolActive(!workerPoolActive)}
                      icon={<RotateCw className={`w-4 h-4 ${workerPoolActive ? 'animate-spin' : ''}`} />}
                      size="sm"
                      isDark={isDark}
                    />
                  </div>
                </div>

              </div>

              {/* Row 2, Col 4: Hybrid Alpha / Top-K Setpoint */}
              <div className={`h-[250px] p-3 flex flex-col justify-between border-b ${isDark ? 'bg-[#262626] border-[#1c1c1c]' : 'bg-[#f4f5f7] border-[#d8d9de]'}`}>
                <div className="text-xs font-normal tracking-wide truncate">
                  <span className={isDark ? 'text-[#d8d8d8]' : 'text-[#2b2b2b]'}>Hybrid α (density)</span>
                </div>

                {/* Readout in pure font-mono */}
                <div 
                  className={`font-mono text-center text-2xl font-bold tracking-wider mt-1 ${isDark ? 'text-[#e5e5e5]' : 'text-[#1e1e1e]'}`}
                >
                  {(hybridAlphaSetpoint / 1000).toFixed(2)} <span className="text-base font-normal">α</span>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <RotaryKnob
                    value={hybridAlphaSetpoint}
                    min={0}
                    max={1000}
                    step={25}
                    size={110}
                    onChange={setHybridAlphaSetpoint}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Row 3, Col 4: Cluster Health */}
              <div className={`p-3 flex flex-col justify-center ${isDark ? 'bg-[#262626]' : 'bg-[#f4f5f7]'}`}>
                <div className={`text-xs truncate ${isDark ? 'text-[#8e8e93]' : 'text-[#64748b]'}`}>
                  Cluster health
                </div>
                <div className="font-mono text-sm mt-1 font-bold text-emerald-500 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>200 OK (HEALTHY)</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Bottom Console Action Footer */}
        <div 
          className={`px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs font-mono ${
            isDark ? 'bg-[#202020] border-[#1c1c1c] text-zinc-400' : 'bg-[#eaecef] border-[#d8d9de] text-zinc-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              150 / 150 EVALUATED
            </span>
            <span className="hidden sm:inline opacity-40">|</span>
            <span className="hidden sm:inline">Faithfulness: <strong className="text-inherit">0.892</strong></span>
            <span className="hidden sm:inline opacity-40">|</span>
            <span className="hidden sm:inline">Recall@10: <strong className="text-inherit">0.941</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('pipeline_lab')}
              className={`px-2.5 py-1 rounded border hover:text-white transition-colors cursor-pointer ${
                isDark ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700' : 'border-zinc-300 bg-white hover:bg-zinc-100'
              }`}
            >
              Open Pipeline Lab
            </button>
            <button
              onClick={() => onNavigate('case_detail')}
              className={`px-2.5 py-1 rounded border hover:text-white transition-colors cursor-pointer ${
                isDark ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700' : 'border-zinc-300 bg-white hover:bg-zinc-100'
              }`}
            >
              Explore 150 Cases
            </button>
            <button
              onClick={() => onNavigate('overview')}
              className="px-3 py-1 rounded bg-[#ff5500] hover:bg-[#e04b00] text-white font-bold transition-all shadow-xs cursor-pointer"
            >
              Full Studio View →
            </button>
          </div>
        </div>

      </div>

      {/* Streamlit Code Modal */}
      <StreamlitCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        currentScreen="overview"
      />
    </div>
  );
};
