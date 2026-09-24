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
  sparkline = []
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

  let deltaBadgeClass = 'text-zinc-400 bg-[#1c1f26] border-[#2b2e38]';
  let DeltaIcon = null;

  if (isPositive) {
    DeltaIcon = ArrowUpRight;
    if (isGood) {
      deltaBadgeClass = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60 shadow-xs';
    } else if (isBad) {
      deltaBadgeClass = 'text-rose-400 bg-rose-950/60 border-rose-800/60 shadow-xs';
    }
  } else if (isNegative) {
    DeltaIcon = ArrowDownRight;
    if (isGood) {
      deltaBadgeClass = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60 shadow-xs';
    } else if (isBad) {
      deltaBadgeClass = 'text-rose-400 bg-rose-950/60 border-rose-800/60 shadow-xs';
    }
  }

  // Generate SVG Sparkline path
  const minVal = Math.min(...sparkline);
  const maxVal = Math.max(...sparkline);
  const range = maxVal - minVal || 1;
  const width = 64;
  const height = 24;
  const points = sparkline.map((v, i) => {
    const x = (i / Math.max(1, sparkline.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  const sparkColor = isGood ? '#10b981' : isBad ? '#f43f5e' : '#ff5500';

  return (
    <div
      id={id}
      className={`group relative overflow-hidden bg-[#16181e] rounded-xl border border-[#262932] p-3 sm:p-3.5 shadow-xs hover:border-[#ff5500]/60 transition-all duration-200 ${className}`}
    >
      {/* Top subtle highlight line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity ${
        isGood
          ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent'
          : isBad
          ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-transparent'
          : 'bg-gradient-to-r from-[#ff5500] via-amber-500 to-transparent'
      }`} />

      {/* Metric Header */}
      <div className="flex items-center justify-between text-xs font-medium text-zinc-400 mb-1">
        <span className="flex items-center gap-1.5">
          {label}
          {help && (
            <span title={help} className="cursor-help text-zinc-400 hover:text-zinc-200">
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
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
          {prefix}{value}{suffix}
        </span>
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${deltaBadgeClass}`}>
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
    <div id={id} className={`border-b border-[#262932] mb-4 ${className}`}>
      <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const count = badgeCounts[tab];
          return (
            <button
              key={tab}
              id={`tab-btn-${tab.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap py-2 px-3 border-b-2 font-mono text-xs transition-all flex items-center gap-1.5 relative rounded-t-md ${
                isActive
                  ? 'border-[#ff5500] text-[#ff7733] font-bold bg-[#201c1a]'
                  : 'border-transparent text-zinc-400 hover:text-white hover:border-[#333742]'
              }`}
            >
              <span>{tab}</span>
              {count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#ff5500] text-white'
                      : 'bg-[#1e2128] text-zinc-400 border border-[#2c303a]'
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
    <div id={id} className={`border border-[#262932] rounded-xl overflow-hidden bg-[#16181e] mb-2.5 shadow-xs transition-all ${className}`}>
      <button
        type="button"
        id={id ? `${id}-header` : undefined}
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 bg-[#191b22] hover:bg-[#20232b] transition-colors text-left font-medium text-xs text-zinc-200"
      >
        <div className="flex items-center gap-2">
          <div className={`p-0.5 rounded transition-transform duration-200 ${expanded ? 'rotate-90 text-[#ff5500]' : 'text-zinc-400'}`}>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-white">{title}</span>
          {subtitle && <span className="text-[11px] text-zinc-400 font-normal ml-1.5">{subtitle}</span>}
        </div>
        {badge && <div>{badge}</div>}
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-[#262932] bg-[#121419] text-xs text-zinc-300 animate-in fade-in duration-150">
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
  let styleClasses = 'bg-[#1a1c22] text-zinc-300 border-[#2b2e38]';
  let dotColor = 'bg-zinc-400';

  if (type === 'status') {
    const s = (status || label).toLowerCase();
    if (s.includes('ready') || s.includes('complete') || s.includes('valid') || s.includes('pass') || s.includes('healthy')) {
      styleClasses = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
      dotColor = 'bg-emerald-400';
    } else if (s.includes('running') || s.includes('active') || s.includes('evaluating')) {
      styleClasses = 'bg-orange-950/40 text-orange-300 border-orange-800/50';
      dotColor = 'bg-[#ff5500] animate-ping';
    } else if (s.includes('fail') || s.includes('error') || s.includes('regress')) {
      styleClasses = 'bg-rose-950/40 text-rose-300 border-rose-800/50';
      dotColor = 'bg-rose-400';
    } else if (s.includes('warn') || s.includes('issue') || s.includes('degraded')) {
      styleClasses = 'bg-amber-950/40 text-amber-300 border-amber-800/50';
      dotColor = 'bg-amber-400';
    } else if (s.includes('draft')) {
      styleClasses = 'bg-[#1c1f26] text-zinc-400 border-[#2c303a]';
      dotColor = 'bg-zinc-400';
    }
  } else if (type === 'version') {
    styleClasses = 'bg-[#1c1f26] text-zinc-200 border-[#2e323e] font-mono font-bold';
    dotColor = 'bg-[#ff7733]';
  } else if (type === 'experiment') {
    styleClasses = 'bg-[#201c1a] text-[#ff7733] border-[#3d2922] font-mono font-semibold';
    dotColor = 'bg-[#ff5500]';
  } else if (type === 'model') {
    styleClasses = 'bg-[#1a1c22] text-zinc-200 border-[#2b2e38] font-mono';
    dotColor = 'bg-[#ff7733]';
  } else if (type === 'judge') {
    styleClasses = 'bg-purple-950/40 text-purple-300 border-purple-800/50 font-mono font-semibold';
    dotColor = 'bg-purple-400';
  } else if (type === 'category') {
    styleClasses = 'bg-[#181a20] text-zinc-300 border-[#282b34]';
    dotColor = 'bg-zinc-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border font-medium ${styleClasses} ${className}`}>
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
      bg: 'bg-[#191b22] border-[#272a33] text-zinc-200',
      icon: <Info className="w-3.5 h-3.5 text-[#ff7733] mt-0.5 shrink-0" />
    },
    warning: {
      bg: 'bg-[#201811] border-[#382618] text-amber-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
    },
    error: {
      bg: 'bg-[#221216] border-[#3c1920] text-rose-200',
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
    },
    success: {
      bg: 'bg-[#101d16] border-[#1a3828] text-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
    }
  };

  const c = configs[type];

  return (
    <div className={`border rounded-lg p-3 flex items-start gap-2.5 ${c.bg} ${className}`}>
      {c.icon}
      <div className="flex-1 text-xs">
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
    <div className="rounded-xl border border-[#262932] bg-[#101216] text-zinc-100 overflow-hidden font-mono text-xs my-2 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#15171e] border-b border-[#262932] text-[10px] text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500/80"></span>
            <span className="w-2 h-2 rounded-full bg-amber-500/80"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="ml-1.5 font-medium text-zinc-300">{title || language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e2129] hover:bg-[#282c37] text-zinc-300 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed max-h-96 text-zinc-300 text-[11px]">
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
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-xs',
    lg: 'px-4 py-2 text-xs sm:text-sm'
  };

  const variantClasses = {
    primary: 'bg-[#ff5500] hover:bg-[#e04b00] active:bg-[#c94200] text-white font-semibold shadow-xs shadow-orange-500/20 border border-orange-500/80 active:scale-[0.99]',
    secondary: 'bg-[#1c1f26] hover:bg-[#252832] text-zinc-200 border border-[#2e323e] font-medium shadow-2xs active:scale-[0.99]',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-600 font-semibold shadow-xs shadow-rose-500/20',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-[#1f2229] font-medium border-transparent'
  };

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
