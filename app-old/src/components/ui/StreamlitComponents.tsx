import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownRight, 
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Sparkles
} from 'lucide-react';

/* ----------------------------------------------------
   1. StMetric
   Elevated Streamlit Metric with micro sparkline & gradient highlight
------------------------------------------------------- */
interface StMetricProps {
  id?: string;
  label: string;
  value: string | number;
  delta?: string | number | null;
  deltaType?: 'normal' | 'inverse' | 'off';
  help?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  trend?: 'up' | 'down' | 'neutral';
  sparkline?: number[];
}

export const StMetric: React.FC<StMetricProps> = ({
  id,
  label,
  value,
  delta,
  deltaType = 'normal',
  help,
  prefix,
  suffix,
  className = '',
  sparkline = [40, 48, 45, 58, 62, 60, 72]
}) => {
  let isPositive = false;
  let isNegative = false;
  let deltaStr = '';

  if (delta !== undefined && delta !== null) {
    if (typeof delta === 'number') {
      isPositive = delta > 0;
      isNegative = delta < 0;
      deltaStr = `${isPositive ? '+' : ''}${delta.toFixed(3)}`;
    } else {
      deltaStr = String(delta);
      isPositive = deltaStr.startsWith('+');
      isNegative = deltaStr.startsWith('-');
    }
  }

  // Determine styling based on deltaType
  let isGood = deltaType === 'normal' ? isPositive : deltaType === 'inverse' ? isNegative : false;
  let isBad = deltaType === 'normal' ? isNegative : deltaType === 'inverse' ? isPositive : false;

  let deltaBadgeClass = 'text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  let DeltaIcon = null;

  if (isPositive) {
    DeltaIcon = ArrowUpRight;
    if (isGood) {
      deltaBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60 shadow-xs';
    } else if (isBad) {
      deltaBadgeClass = 'text-rose-700 bg-rose-50 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 shadow-xs';
    }
  } else if (isNegative) {
    DeltaIcon = ArrowDownRight;
    if (isGood) {
      deltaBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60 shadow-xs';
    } else if (isBad) {
      deltaBadgeClass = 'text-rose-700 bg-rose-50 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60 shadow-xs';
    }
  }

  // Generate SVG Sparkline path
  const minVal = Math.min(...sparkline);
  const maxVal = Math.max(...sparkline);
  const range = maxVal - minVal || 1;
  const width = 64;
  const height = 24;
  const points = sparkline.map((v, i) => {
    const x = (i / (sparkline.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  const sparkColor = isGood ? '#10b981' : isBad ? '#f43f5e' : '#6366f1';

  return (
    <div 
      id={id}
      className={`group relative overflow-hidden bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-200 ${className}`}
    >
      {/* Top subtle highlight line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity ${
        isGood 
          ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent' 
          : isBad 
          ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-transparent'
          : 'bg-gradient-to-r from-indigo-500 via-purple-400 to-transparent'
      }`} />

      {/* Metric Header */}
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        <span className="flex items-center gap-1.5">
          {label}
          {help && (
            <span title={help} className="cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          )}
        </span>

        {/* Micro Sparkline */}
        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              fill="none"
              stroke={sparkColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>

      {/* Metric Value & Delta */}
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
          {prefix}{value}{suffix}
        </span>
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${deltaBadgeClass}`}>
            {DeltaIcon && <DeltaIcon className="w-3 h-3 stroke-[2.5]" />}
            <span>{deltaStr}</span>
          </span>
        )}
      </div>
    </div>
  );
};

/* ----------------------------------------------------
   2. StTabs
   Modern Segmented Control & Tab Bar
------------------------------------------------------- */
interface StTabsProps {
  id?: string;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  badgeCounts?: Record<string, number>;
  className?: string;
}

export const StTabs: React.FC<StTabsProps> = ({
  id,
  tabs,
  activeTab,
  onTabChange,
  badgeCounts = {},
  className = ''
}) => {
  return (
    <div id={id} className={`border-b border-slate-200 dark:border-slate-800 mb-5 ${className}`}>
      <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const count = badgeCounts[tab];
          return (
            <button
              key={tab}
              id={`tab-btn-${tab.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap py-3 px-3.5 border-b-2 font-medium text-xs sm:text-sm transition-all flex items-center gap-2 relative rounded-t-lg ${
                isActive
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span>{tab}</span>
              {count !== undefined && (
                <span 
                  className={`text-[11px] px-2 py-0.2 rounded-full font-mono font-semibold transition-colors ${
                    isActive 
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

/* ----------------------------------------------------
   3. StExpander
   Streamlit collapsible container with chevron
------------------------------------------------------- */
interface StExpanderProps {
  id?: string;
  title: string | React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  className?: string;
}

export const StExpander: React.FC<StExpanderProps> = ({
  id,
  title,
  defaultExpanded = false,
  children,
  subtitle,
  badge,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div id={id} className={`border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 mb-3 shadow-xs transition-all ${className}`}>
      <button
        type="button"
        id={id ? `${id}-header` : undefined}
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors text-left font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-200"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1 rounded-md transition-transform duration-200 ${expanded ? 'rotate-90 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <ChevronRight className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{title}</span>
          {subtitle && <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">{subtitle}</span>}
        </div>
        {badge && <div>{badge}</div>}
      </button>
      {expanded && (
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs sm:text-sm text-slate-700 dark:text-slate-300 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
};

/* ----------------------------------------------------
   4. StBadge
   Technical badge system: Status, Version, Model, Judge
------------------------------------------------------- */
export const StBadge: React.FC<{
  type?: 'status' | 'version' | 'experiment' | 'model' | 'judge' | 'category' | 'diff' | 'custom';
  status?: string;
  label: string;
  className?: string;
}> = ({ type = 'custom', status, label, className = '' }) => {
  let styleClasses = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let dotColor = 'bg-slate-400';

  if (type === 'status') {
    const s = (status || label).toLowerCase();
    if (s.includes('ready') || s.includes('complete') || s.includes('valid') || s.includes('pass') || s.includes('healthy')) {
      styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50';
      dotColor = 'bg-emerald-500';
    } else if (s.includes('running') || s.includes('active') || s.includes('evaluating')) {
      styleClasses = 'bg-indigo-50 text-indigo-800 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50';
      dotColor = 'bg-indigo-500 animate-ping';
    } else if (s.includes('fail') || s.includes('error') || s.includes('regress')) {
      styleClasses = 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50';
      dotColor = 'bg-rose-500';
    } else if (s.includes('warn') || s.includes('issue') || s.includes('degraded')) {
      styleClasses = 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50';
      dotColor = 'bg-amber-500';
    } else if (s.includes('draft')) {
      styleClasses = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      dotColor = 'bg-slate-400';
    }
  } else if (type === 'version') {
    styleClasses = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-mono font-bold';
    dotColor = 'bg-indigo-400';
  } else if (type === 'experiment') {
    styleClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 font-mono font-semibold';
    dotColor = 'bg-indigo-500';
  } else if (type === 'model') {
    styleClasses = 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 font-mono';
    dotColor = 'bg-sky-400';
  } else if (type === 'judge') {
    styleClasses = 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-mono font-semibold';
    dotColor = 'bg-purple-400';
  } else if (type === 'category') {
    styleClasses = 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700';
    dotColor = 'bg-slate-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border font-medium ${styleClasses} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
};

/* ----------------------------------------------------
   5. StAlert
   Streamlit info/warning/success/error box
------------------------------------------------------- */
export const StAlert: React.FC<{
  type: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ type, title, children, action, className = '' }) => {
  const configs = {
    info: {
      bg: 'bg-blue-50/80 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-200',
      icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
    },
    warning: {
      bg: 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
    },
    error: {
      bg: 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
    },
    success: {
      bg: 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
    }
  };

  const c = configs[type];

  return (
    <div className={`border rounded-xl p-4 flex items-start gap-3.5 backdrop-blur-xs ${c.bg} ${className}`}>
      {c.icon}
      <div className="flex-1 text-xs sm:text-sm">
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div className="leading-relaxed opacity-95">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

/* ----------------------------------------------------
   6. StCodeBlock & JSONViewer
   Streamlit style code preview with terminal window header
------------------------------------------------------- */
export const StCodeBlock: React.FC<{
  code: string;
  language?: string;
  title?: string;
}> = ({ code, language = 'python', title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B0F19] text-slate-100 overflow-hidden font-mono text-xs my-2.5 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/90 border-b border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="ml-2 font-medium text-slate-300">{title || language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto leading-relaxed max-h-96 text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/* ----------------------------------------------------
   7. StButton
   Streamlit tactile primary / secondary buttons
------------------------------------------------------- */
export const StButton: React.FC<{
  id?: string;
  label: string | React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}> = ({
  id,
  label,
  onClick,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs sm:text-sm',
    lg: 'px-5 py-2.5 text-sm sm:text-base'
  };

  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs shadow-indigo-500/20 border border-indigo-500 active:scale-[0.99]',
    secondary: 'bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium shadow-2xs active:scale-[0.99]',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-600 font-semibold shadow-xs shadow-rose-500/20',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 font-medium border-transparent'
  };

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
