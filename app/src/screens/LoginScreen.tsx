import React, { useState } from 'react';
import { 
  Zap, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ScreenId } from '../types';

interface LoginScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
  initialError?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate, initialError = '' }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault(); setIsLoading(true); setError('');
    try { await login(email, password); onNavigate('overview'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign in failed.'); }
    finally { setIsLoading(false); }
  };

  const handleForgotPassword = () => {
    showToast({
      type: 'info',
      title: 'Contact your local administrator',
      message: 'Automatic password recovery is not configured.'
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#0e1014] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-14 relative overflow-hidden select-none font-sans">
      {/* Background Subtle Ambient Glow & Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 45%, rgba(255, 85, 0, 0.08) 0%, transparent 45%),
            radial-gradient(circle at 75% 55%, rgba(255, 85, 0, 0.04) 0%, transparent 50%),
            linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px'
        }}
      />

      {/* Top Bar: Version Tag */}
      <div className="w-full flex justify-end relative z-10">
        <div className="px-2.5 py-1 rounded-md bg-[#161820]/90 border border-[#272a34] text-[#ff5500] font-mono text-xs font-semibold tracking-wider">
          v1.4.2
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center my-auto relative z-10 py-6">
        
        {/* Left Column: Brand, Headline, and RAG Architecture Diagram */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-8 pr-0 lg:pr-6">
          {/* Logo + Brand Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff5500] flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-wider text-white font-mono">
              RAGGauge
            </span>
          </div>

          {/* Heading with Orange Period */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white leading-[1.15]">
              Evaluate with confidence<span className="text-[#ff5500]">.</span>
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-lg leading-relaxed">
              Build, run, and analyze retrieval evaluations for real-world AI systems.
            </p>
          </div>

          {/* Graphical Pipeline Illustration */}
          <div className="relative w-full max-w-xl h-64 sm:h-72 mt-4 pt-2">
            {/* Background Grid Floor Perspective in SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 520 280">
              <defs>
                <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff5500" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ff7722" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Perspective grid floor lines */}
              <path d="M 40 240 L 480 240 M 80 260 L 440 260 M 150 210 L 420 210" stroke="#23262f" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
              <path d="M 120 270 L 220 200 M 240 270 L 300 200 M 360 270 L 380 200" stroke="#23262f" strokeWidth="1" opacity="0.3" />
              
              {/* Connector Wires from card dots into the right document container */}
              {/* Wire 1: Queries (Orange) */}
              <path 
                d="M 175 48 C 240 48, 260 90, 310 98" 
                fill="none" 
                stroke="#ff5500" 
                strokeWidth="1.5" 
                opacity="0.75"
              />
              {/* Wire 2: Retrieval (Emerald) */}
              <path 
                d="M 175 118 C 230 118, 250 145, 305 152" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.5" 
                opacity="0.85"
              />
              {/* Wire 3: Evaluation (Orange) */}
              <path 
                d="M 175 188 C 245 188, 265 170, 305 160" 
                fill="none" 
                stroke="#ff5500" 
                strokeWidth="1.5" 
                opacity="0.75"
              />

              {/* Subtle ambient particle dots */}
              <circle cx="270" cy="115" r="1.5" fill="#ff5500" opacity="0.6" />
              <circle cx="250" cy="220" r="1.5" fill="#ff5500" opacity="0.8" />
              <circle cx="340" cy="235" r="1" fill="#10b981" opacity="0.5" />
            </svg>

            {/* Left 3 Pipeline Cards */}
            <div className="absolute left-0 top-0 space-y-3.5 z-10">
              {/* Card 1: Queries */}
              <div className="relative w-44 sm:w-48 p-3 rounded-xl bg-[#16181f]/90 border border-[#272a33] shadow-lg backdrop-blur-xs flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-zinc-200">Queries</div>
                  <div className="mt-1.5 space-y-1">
                    <div className="w-20 h-1 rounded-full bg-zinc-800" />
                    <div className="w-14 h-1 rounded-full bg-zinc-800/60" />
                  </div>
                </div>
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#ff5500] ring-4 ring-[#ff5500]/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>

              {/* Card 2: Retrieval */}
              <div className="relative w-44 sm:w-48 p-3 rounded-xl bg-[#16181f]/90 border border-[#272a33] shadow-lg backdrop-blur-xs flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-zinc-200">Retrieval</div>
                  <div className="mt-1.5 space-y-1">
                    <div className="w-24 h-1 rounded-full bg-zinc-800" />
                    <div className="w-16 h-1 rounded-full bg-zinc-800/60" />
                  </div>
                </div>
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#10b981] ring-4 ring-[#10b981]/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>

              {/* Card 3: Evaluation */}
              <div className="relative w-44 sm:w-48 p-3 rounded-xl bg-[#16181f]/90 border border-[#272a33] shadow-lg backdrop-blur-xs flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-zinc-200">Evaluation</div>
                  <div className="mt-1.5 space-y-1">
                    <div className="w-18 h-1 rounded-full bg-zinc-800" />
                    <div className="w-12 h-1 rounded-full bg-zinc-800/60" />
                  </div>
                </div>
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#ff5500] ring-4 ring-[#ff5500]/20 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>
            </div>

            {/* Right Cascading Evaluation Document Stack */}
            <div className="absolute right-6 sm:right-16 top-4 z-10">
              {/* Back Card 2 */}
              <div className="absolute -left-5 -top-3 w-40 sm:w-48 h-52 rounded-2xl border border-[#22252c]/60 bg-[#121418]/40 transform -rotate-6 pointer-events-none" />
              {/* Back Card 1 */}
              <div className="absolute -left-2.5 -top-1.5 w-40 sm:w-48 h-52 rounded-2xl border border-[#262932]/80 bg-[#14161a]/60 transform -rotate-3 pointer-events-none" />
              
              {/* Front Document Card */}
              <div className="relative w-40 sm:w-48 h-52 rounded-2xl border border-[#2c303c] bg-[#171920]/90 p-4 shadow-2xl backdrop-blur-sm flex flex-col justify-start">
                {/* Target Connector receiver dots */}
                <div className="absolute -left-2.5 top-16 w-2.5 h-2.5 rounded-full bg-[#ff5500] ring-4 ring-[#ff5500]/20" />
                <div className="absolute -left-2.5 top-32 w-2.5 h-2.5 rounded-full bg-[#10b981] ring-4 ring-[#10b981]/20" />

                {/* Orange glowing highlight bar */}
                <div className="w-20 h-2 rounded-full bg-[#ff5500] shadow-[0_0_14px_rgba(255,85,0,0.7)] mt-3" />

                {/* Document text skeleton lines */}
                <div className="mt-4 space-y-2">
                  <div className="w-full h-1.5 rounded-full bg-zinc-700/60" />
                  <div className="w-4/5 h-1.5 rounded-full bg-zinc-700/60" />
                  <div className="w-full h-1.5 rounded-full bg-zinc-700/40" />
                  <div className="w-3/4 h-1.5 rounded-full bg-zinc-700/40" />
                  <div className="w-1/2 h-1.5 rounded-full bg-zinc-700/30" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sleek Floating Sign-In Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-[460px] rounded-3xl border border-[#272a33] bg-[#15171e]/95 p-8 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-xl">
            
            {/* Form Header */}
            <div className="space-y-1 mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-zinc-400">
                Sign in to your workspace
              </p>
            </div>

            {/* Sign-in Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {error && <div role="alert" className="text-sm text-rose-300 bg-rose-950/30 p-3 rounded-lg">{error}</div>}
              {/* Field 1: Email or username */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Email or username
                </label>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#111317] border border-[#272a33] text-sm text-white focus-within:border-[#ff5500] focus-within:ring-1 focus-within:ring-[#ff5500]/25 transition-all">
                  <User className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="text" aria-label="Username" autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-transparent border-none outline-none font-sans text-sm text-white placeholder-zinc-500"
                    required
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#111317] border border-[#272a33] text-sm text-white focus-within:border-[#ff5500] focus-within:ring-1 focus-within:ring-[#ff5500]/25 transition-all">
                  <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    aria-label="Password" autoComplete="current-password" type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent border-none outline-none font-sans text-sm text-white placeholder-zinc-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password? */}
              <div className="flex items-center justify-between pt-1">
<span className="text-xs text-zinc-400">Session lasts until sign-out or expiry</span>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs sm:text-sm font-medium text-[#ff5500] hover:text-[#ff6a1a] transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign in Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl font-semibold text-sm sm:text-base text-white bg-[#ff5500] hover:bg-[#e04b00] active:bg-[#c94200] transition-all shadow-lg shadow-orange-500/25 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Bottom Security Guarantee */}
            <div className="mt-8 pt-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <div className="w-4 h-4 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
              </div>
              <span>Secure access to your evaluation workspace</span>
            </div>

          </div>
        </div>

      </div>

      {/* Bottom Subtle Bar (Empty spacer for symmetrical padding) */}
      <div className="w-full relative z-10" />
    </div>
  );
};
