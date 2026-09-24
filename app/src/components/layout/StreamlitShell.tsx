import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Database,
  FlaskConical,
  GitCompare,
  Sliders,
  Search,
  Cpu,
  Workflow,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Code2,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Moon,
  Sun,
  ChevronDown,
  Play,
  FileSpreadsheet,
  CheckCircle2,
  Bell,
  User,
  LogOut,
  Gauge
} from 'lucide-react';
import { useRAGGauge } from '../../context/DataContext';
import { ScreenId } from '../../types';
import { StBadge, StButton } from '../ui/StreamlitComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { CommandPalette } from '../navigation/CommandPalette';
import { StreamlitCodeModal } from '../modals/StreamlitCodeModal';

interface StreamlitShellProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
  breadcrumbs?: { label: string; screen?: ScreenId }[];
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  contextBadge?: string;
  children: React.ReactNode;
  onOpenCodeModal?: () => void;
}

export const StreamlitShell: React.FC<StreamlitShellProps> = ({
  currentScreen,
  onNavigate,
  breadcrumbs = [],
  primaryAction,
  secondaryAction,
  contextBadge,
  children,
  onOpenCodeModal
}) => {
  const { snapshot, refresh } = useRAGGauge();
  const latestRun = [...snapshot.runs].reverse()[0];
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState('default workspace');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Keyboard shortcut for Command Palette (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refresh(); showToast({type:'success', title:'Workspace synced', message:'Persisted data refreshed.'}); }
    catch (reason) { showToast({type:'error', title:'Refresh failed', message:reason instanceof Error ? reason.message : 'API unavailable'}); }
    finally { setIsRefreshing(false); }
  };
  const projects = [{id:'default', name:'default workspace', cases:snapshot.datasets.reduce((sum, item) => sum + item.cases.length, 0), target:`${snapshot.datasets.length} datasets`}];

  const navItems = [
    { id: 'overview' as ScreenId, label: 'Overview', icon: BarChart3, badge: 'Live' },
    { id: 'datasets' as ScreenId, label: 'Datasets', icon: Database, badge: String(snapshot.datasets.length) },
    { id: 'experiments' as ScreenId, label: 'Experiments', icon: FlaskConical, badge: String(snapshot.runs.length) },
    { id: 'compare' as ScreenId, label: 'Compare Runs', icon: GitCompare, badge: 'Diff' },
    { id: 'pipeline_lab' as ScreenId, label: 'Pipeline Lab', icon: Sliders, badge: 'Sandbox' },
    { id: 'case_detail' as ScreenId, label: 'Case Explorer', icon: Search }
  ];

  const adminNavItems = [
    { id: 'models_judges' as ScreenId, label: 'Models & Judges', icon: Cpu },
    { id: 'adapters' as ScreenId, label: 'Adapters', icon: Workflow, badge: String(snapshot.adapters.length) },
    { id: 'configuration' as ScreenId, label: 'Configuration', icon: ShieldCheck },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings }
  ];

  const openCodeModalHandler = onOpenCodeModal || (() => setIsCodeModalOpen(true));

  return (
    <div className="min-h-screen bg-[#0d0f12] text-zinc-100 flex flex-col antialiased transition-colors duration-200 selection:bg-[#ff5500] selection:text-white">
      {/* Top Telemetry Ticker & Navigation Bar */}
      <header className="h-11 bg-[#131519] border-b border-[#22252c] px-3.5 flex items-center justify-between text-xs select-none z-30 sticky top-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-[#1f2229] rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Logo */}
          <div
            onClick={() => onNavigate('overview')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-md bg-[#ff5500] text-white flex items-center justify-center text-xs font-bold shadow-xs shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <Zap className="w-3.5 h-3.5 fill-white text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs tracking-wider text-white font-mono">
                RAGGauge
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1f222a] text-[#ff7733] border border-[#303440] font-semibold">
                v1.4.2
              </span>
            </div>
          </div>

          <div className="h-3.5 w-[1px] bg-[#262932] mx-1 hidden sm:block" />

          {/* Project Switcher Dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#1a1c22] text-xs font-medium text-zinc-300 transition-colors border border-transparent hover:border-[#272a33]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="max-w-[170px] truncate text-[11px] font-mono">{activeProject}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {projectDropdownOpen && (
              <div
                className="absolute left-0 mt-1 w-64 bg-[#16181e] border border-[#2b2e38] rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in duration-100"
                onClick={() => setProjectDropdownOpen(false)}
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Benchmark Suites
                </div>
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setActiveProject(proj.name);
                      showToast({
                        type: 'info',
                        title: 'Benchmark suite switched',
                        message: `Loaded ${proj.name} (${proj.cases} test cases)`
                      });
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#20232a] transition-colors ${
                      activeProject === proj.name ? 'text-[#ff5500] font-semibold bg-[#221c1a]' : 'text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="truncate text-xs">{proj.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">{proj.cases} cases • {proj.target}</div>
                    </div>
                    {activeProject === proj.name && <CheckCircle2 className="w-3.5 h-3.5 text-[#ff5500] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-3 hidden lg:block">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#181a20] border border-[#272a33] text-zinc-400 hover:text-zinc-200 text-xs hover:border-[#ff5500]/50 transition-all"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#ff5500]" />
              <span className="text-[11px]">Search benchmarks, cases, configs...</span>
            </div>
            <div className="flex items-center gap-0.5 font-mono text-[10px] bg-[#121316] px-1.5 py-0.2 rounded border border-[#262830] text-zinc-400">
              <span>⌘</span>
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right Actions: Quick Flows, Streamlit Code, Theme Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Quick Flow Pills */}
          <div className="hidden xl:flex items-center gap-0.5 bg-[#17191f] p-0.5 rounded-lg border border-[#272a32] text-[11px]">
            <button
              onClick={() => onNavigate('new_experiment')}
              className="px-2 py-0.5 rounded hover:bg-[#22252e] hover:text-[#ff5500] text-zinc-300 font-medium transition-all"
              title="Launch RAG Evaluation Run"
            >
              Eval
            </button>
            <button
              onClick={() => onNavigate('pipeline_lab')}
              className="px-2 py-0.5 rounded hover:bg-[#22252e] hover:text-[#ff5500] text-zinc-300 font-medium transition-all"
              title="Open Interactive Pipeline Tuning Sandbox"
            >
              Lab
            </button>
            <button
              onClick={() => onNavigate('compare')}
              className="px-2 py-0.5 rounded hover:bg-[#22252e] hover:text-[#ff5500] text-zinc-300 font-medium transition-all"
              title="Compare Candidate vs Baseline Runs"
            >
              Compare
            </button>
          </div>

          {/* Search button on small screens */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:bg-[#1f2229] transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>


          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md border border-[#272a32] text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2229] transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {/* User Account / Login Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border border-[#272a32] hover:bg-[#1f2229] transition-colors text-xs"
            >
              <div className="w-5 h-5 rounded bg-gradient-to-tr from-[#ff5500] to-amber-500 text-white flex items-center justify-center font-bold text-[9px] font-mono">
                {user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'MS'}
              </div>
              <span className="hidden md:inline font-semibold text-zinc-200 truncate max-w-[100px] text-[11px]">
                {user ? user.name : 'Mukesh Sakre'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 w-60 bg-[#16181e] border border-[#2a2d36] rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in duration-100"
                onClick={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#252832]">
                  <div className="font-bold text-white text-xs">{user?.name || 'Mukesh Sakre'}</div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">{user?.email || 'mukeshsakre.85@gmail.com'}</div>
                  <div className="text-[10px] text-[#ff7733] mt-0.5 font-semibold">{user?.role || 'Lead Applied AI / RAG Engineer'}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { void logout(); onNavigate('overview'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#20232a] text-zinc-300 flex items-center gap-2 text-xs"
                  >
                    <User className="w-3.5 h-3.5 text-[#ff5500]" />
                    <span>Switch Engineer / Login</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      showToast({
                        type: 'info',
                        title: 'Signed Out',
                        message: 'Session ended. Returned to login portal.'
                      });
                      onNavigate('login');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 flex items-center gap-2 text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Compact Sleek Left Sidebar */}
        <aside
          className={`bg-[#14161b] border-r border-[#22252c] flex flex-col shrink-0 transition-all duration-200 z-20 ${
            sidebarOpen ? 'w-56' : 'w-0 overflow-hidden border-r-0'
          }`}
        >
          {/* Active Suite Card */}
          <div className="p-2.5 border-b border-[#22252c]">
            <div
              onClick={() => onNavigate('experiment_details', { experimentId: latestRun?.id })}
              className="p-2 rounded-lg bg-[#191b21] border border-[#272a33] hover:border-[#ff5500]/50 transition-colors cursor-pointer flex items-center justify-between"
              title="Click to view run evidence and metrics"
            >
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                  Target Evaluation Run
                </div>
                <div className="text-[11px] font-bold text-white font-mono truncate mt-0.5">
                  {latestRun?.id || 'No persisted run'}
                </div>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {latestRun?.status || 'IDLE'}
              </span>
            </div>
          </div>

          {/* Primary Navigation Sections */}
          <div className="flex-1 overflow-y-auto py-2.5 px-2 space-y-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 px-2.5 mb-1 flex items-center justify-between">
                <span>Benchmarking Core</span>
                <span className="text-[8px] font-mono text-zinc-400">RAG</span>
              </div>
              <nav className="space-y-0.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentScreen === item.id ||
                    (item.id === 'experiments' && ['new_experiment', 'experiment_running', 'experiment_details'].includes(currentScreen)) ||
                    (item.id === 'datasets' && ['dataset_detail', 'create_dataset'].includes(currentScreen)) ||
                    (item.id === 'compare' && ['regression_analysis', 'recommendation'].includes(currentScreen));

                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#ff5500] text-white font-semibold shadow-xs shadow-orange-500/30'
                          : 'text-zinc-300 hover:bg-[#1d2027] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isActive
                            ? 'bg-[#e04b00] text-white font-bold'
                            : 'bg-[#1e2128] text-zinc-400 border border-[#2b2e38]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-2 border-t border-[#22252c]">
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 px-2.5 mb-1">
                Engineering Governance
              </div>
              <nav className="space-y-0.5">
                {adminNavItems.filter(item => snapshot.user.role === 'ADMIN' || !['configuration','settings'].includes(item.id)).map((item) => {
                  const Icon = item.icon;
                  const isActive = currentScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#ff5500] text-white font-semibold shadow-xs shadow-orange-500/30'
                          : 'text-zinc-300 hover:bg-[#1d2027] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isActive ? 'bg-[#e04b00] text-white' : 'bg-[#1e2128] text-zinc-400 border border-[#2b2e38]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sidebar Footer: Cluster Health Telemetry */}
          <div className="p-2.5 border-t border-[#22252c] bg-[#101216] text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-zinc-300">Local workspace connected</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-400">{snapshot.jobs.filter(job => ['PENDING', 'RUNNING'].includes(job.status)).length} active jobs</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[#1e2129] h-1 rounded-full overflow-hidden mb-1.5">
              <div className="bg-gradient-to-r from-emerald-500 to-[#ff5500] h-full w-full" />
            </div>
            <div className="text-[9px] text-zinc-400 flex items-center justify-between">
              <span>Evaluator: <strong className="text-zinc-300 font-mono">{snapshot.models.find(model => model.roles.includes('JUDGE'))?.model || 'Not configured'}</strong></span>
              <span className="font-mono">Database policy</span>
            </div>

            {/* Engineer Profile Quick Card */}
            {sidebarOpen && (
              <div className="mt-2 pt-2 border-t border-[#1f2229] flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-[#ff5500] text-white flex items-center justify-center font-bold text-[9px] shrink-0 font-mono">
                    {user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'MS'}
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-zinc-200 truncate leading-tight">
                      {user ? user.name : 'Mukesh Sakre'}
                    </div>
                    <div className="text-[8px] text-zinc-400 truncate">
                      {user?.role}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { void logout(); onNavigate('overview'); }}
                  className="p-1 rounded hover:bg-[#1f2229] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Shell */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0d0f12]">
          {/* Breadcrumb & Screen Action Bar */}
          <header className="bg-[#131519]/90 backdrop-blur-md border-b border-[#22252c] px-4 py-2 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-xs">
            {/* Breadcrumb & Title */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-400" />}
                  {b.screen ? (
                    <button
                      onClick={() => onNavigate(b.screen!)}
                      className="text-zinc-400 hover:text-white font-medium transition-colors"
                    >
                      {b.label}
                    </button>
                  ) : (
                    <span className="font-bold text-white font-mono">{b.label}</span>
                  )}
                </React.Fragment>
              ))}

              {contextBadge && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-[#1e2129] text-[#ff7733] border border-[#2e323e]">
                  {contextBadge}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRefresh}
                className={`p-1.5 rounded-lg border border-[#272a32] text-zinc-400 hover:text-white hover:bg-[#1f2229] transition-colors ${
                  isRefreshing ? 'animate-spin text-[#ff5500]' : ''
                }`}
                title="Refresh benchmarks & evaluation traces"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {secondaryAction && (
                <StButton
                  label={secondaryAction.label}
                  onClick={secondaryAction.onClick}
                  variant="secondary"
                  size="sm"
                />
              )}

              {primaryAction && (
                <StButton
                  label={primaryAction.label}
                  onClick={primaryAction.onClick}
                  variant={primaryAction.variant || 'primary'}
                  size="sm"
                />
              )}
            </div>
          </header>

          {/* Screen Content Container (Dense compact desktop with high info density) */}
          <div className="flex-1 p-3.5 sm:p-5 max-w-[1600px] w-full mx-auto animate-in fade-in duration-150">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
        onOpenCodeModal={() => {
          setIsCommandPaletteOpen(false);
          setIsCodeModalOpen(true);
        }}
      />

      {/* Streamlit Python Source Code Modal */}
      <StreamlitCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        currentScreen={currentScreen}
      />
    </div>
  );
};
