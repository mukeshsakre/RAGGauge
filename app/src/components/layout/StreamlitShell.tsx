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
  LogOut
} from 'lucide-react';
import { ScreenId } from '../../types';
import { StBadge, StButton } from '../ui/StreamlitComponents';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { CommandPalette } from '../navigation/CommandPalette';
import { useRAGGauge } from '../../context/DataContext';

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
}

export const StreamlitShell: React.FC<StreamlitShellProps> = ({
  currentScreen,
  onNavigate,
  breadcrumbs = [],
  primaryAction,
  secondaryAction,
  contextBadge,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { snapshot, refresh, signOut } = useRAGGauge();
  const [activeProject, setActiveProject] = useState(
    snapshot.datasets[0]?.name || 'Default workspace'
  );

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
    showToast({
      type: 'info',
      title: 'Syncing telemetry...',
      message: 'Fetching persisted records from the local API.'
    });
    try {
      await refresh();
      setIsRefreshing(false);
      showToast({
        type: 'success',
        title: 'Workspace refreshed',
        message: 'Persisted datasets, runs, comparisons, and jobs are up to date.'
      });
    } catch (error) {
      setIsRefreshing(false);
      showToast({
        type: 'error',
        title: 'Refresh failed',
        message: error instanceof Error ? error.message : 'Unable to refresh the workspace.'
      });
    }
  };

  const projects = snapshot.datasets.map(dataset => ({
    id: dataset.id,
    name: dataset.name,
    cases: dataset.cases?.length || 0,
    target: `v${dataset.version}`,
  }));
  const latestRun = snapshot.runs.at(-1);
  const activeJobs = snapshot.jobs.filter(job => ['PENDING', 'RUNNING'].includes(job.status)).length;

  const navItems = [
    { id: 'overview' as ScreenId, label: 'Overview', icon: BarChart3, badge: activeJobs ? `${activeJobs} live` : undefined },
    { id: 'datasets' as ScreenId, label: 'Datasets', icon: Database, badge: String(snapshot.datasets.length) },
    { id: 'experiments' as ScreenId, label: 'Experiments', icon: FlaskConical, badge: String(snapshot.runs.length) },
    { id: 'compare' as ScreenId, label: 'Compare Runs', icon: GitCompare, badge: String(snapshot.comparisons.length) },
    { id: 'pipeline_lab' as ScreenId, label: 'Pipeline Lab', icon: Sliders },
    { id: 'case_detail' as ScreenId, label: 'Case Explorer', icon: Search }
  ];

  const adminNavItems = [
    { id: 'models_judges' as ScreenId, label: 'Models & Judges', icon: Cpu },
    { id: 'adapters' as ScreenId, label: 'Adapters', icon: Workflow, badge: String(snapshot.adapters.length) },
    { id: 'configuration' as ScreenId, label: 'Configuration', icon: ShieldCheck },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200 selection:bg-indigo-500 selection:text-white">
      {/* Top Telemetry Ticker & Navigation Bar */}
      <header className="h-12 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/80 px-4 flex items-center justify-between text-xs select-none z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          
          {/* Logo */}
          <div 
            onClick={() => onNavigate('overview')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-xs shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                RAGGauge
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                v0.1.0
              </span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Project Switcher Dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="max-w-[170px] truncate">{activeProject}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {projectDropdownOpen && (
              <div 
                className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in duration-100"
                onClick={() => setProjectDropdownOpen(false)}
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
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
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      activeProject === proj.name ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="truncate">{proj.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{proj.cases} cases • {proj.target}</div>
                    </div>
                    {activeProject === proj.name && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-md mx-4 hidden lg:block">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-850 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span>Search benchmarks, cases, configs...</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
              <span>⌘</span>
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Flow Pills */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
            <button
              onClick={() => onNavigate('new_experiment')}
              className="px-2 py-0.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 font-medium transition-all"
              title="Launch RAG Evaluation Run"
            >
              Eval
            </button>
            <button
              onClick={() => onNavigate('pipeline_lab')}
              className="px-2 py-0.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 font-medium transition-all"
              title="Open Interactive Pipeline Tuning Sandbox"
            >
              Lab
            </button>
            <button
              onClick={() => onNavigate('compare')}
              className="px-2 py-0.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 font-medium transition-all"
              title="Compare Candidate vs Baseline Runs"
            >
              Compare
            </button>
          </div>

          {/* Search button on small screens */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
            {snapshot.user.username} · {snapshot.user.role}
          </span>
          <button
            onClick={() => void signOut()}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Modern Sleek Left Sidebar */}
        <aside 
          className={`bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-all duration-200 z-20 ${
            sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
          }`}
        >
          {/* Active Suite Card */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Target Evaluation Run
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono truncate mt-0.5">
                  {latestRun?.id || 'No persisted runs'}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {latestRun?.status || 'EMPTY'}
              </span>
            </div>
          </div>

          {/* Primary Navigation Sections */}
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1.5 flex items-center justify-between">
                <span>Benchmarking Core</span>
                <span className="text-[9px] font-mono text-slate-400">RAG</span>
              </div>
              <nav className="space-y-1">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/30'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-850 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                          isActive 
                            ? 'bg-indigo-700/80 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1.5">
                Engineering Governance
              </div>
              <nav className="space-y-1">
                {(snapshot.user.role === 'ADMIN' ? adminNavItems : []).map((item) => {
                  const Icon = item.icon;
                  const isActive = currentScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-600/30'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                          isActive ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
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

          {/* Sidebar Footer: local control-plane status */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">PostgreSQL ready</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{activeJobs} active</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full w-full" />
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Workspace: <strong className="text-slate-600 dark:text-slate-300 font-mono">default</strong></span>
              <span className="font-mono">{snapshot.runs.length} runs</span>
            </div>
          </div>
        </aside>

        {/* Main Content Shell */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 dark:bg-[#07090E]">
          {/* Breadcrumb & Screen Action Bar */}
          <header className="bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 shadow-xs">
            {/* Breadcrumb & Title */}
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  {b.screen ? (
                    <button
                      onClick={() => onNavigate(b.screen!)}
                      className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium transition-colors"
                    >
                      {b.label}
                    </button>
                  ) : (
                    <span className="font-bold text-slate-900 dark:text-white">{b.label}</span>
                  )}
                </React.Fragment>
              ))}

              {contextBadge && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                  {contextBadge}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className={`p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                  isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''
                }`}
                title="Refresh benchmarks & evaluation traces"
              >
                <RefreshCw className="w-4 h-4" />
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

          {/* Screen Content Container (Target 1440px desktop with responsive margins) */}
          <div className="flex-1 p-6 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
