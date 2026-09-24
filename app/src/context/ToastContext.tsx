import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'error' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    const timer = setTimeout(() => {
      removeToast(id);
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => {
          const icons = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
            info: <Info className="w-4 h-4 text-[#ff7733] shrink-0 mt-0.5" />,
            warning: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          };

          const borders = {
            success: 'border-emerald-500/30 bg-[#15171e]/95 text-zinc-100 shadow-xl shadow-black/50',
            error: 'border-rose-500/30 bg-[#15171e]/95 text-zinc-100 shadow-xl shadow-black/50',
            info: 'border-[#ff5500]/30 bg-[#15171e]/95 text-zinc-100 shadow-xl shadow-black/50',
            warning: 'border-amber-500/30 bg-[#15171e]/95 text-zinc-100 shadow-xl shadow-black/50'
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${borders[toast.type]}`}
            >
              {icons[toast.type]}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{toast.title}</p>
                {toast.message && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-zinc-400 hover:text-white transition-colors shrink-0 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
