import React, { useState } from 'react';
import { 
  Workflow, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Sliders, 
  Copy,
  Clock,
  X
} from 'lucide-react';
import { StBadge, StButton, StCodeBlock, StAlert } from '../components/ui/StreamlitComponents';
import { mockAdapters } from '../mockData';
import { ScreenId, AdapterConfig } from '../types';
import { createAdapter } from '../api';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

interface AdaptersScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const AdaptersScreen: React.FC<AdaptersScreenProps> = ({ onNavigate }) => {
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterConfig | null>(null);
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();

  const registerAdapter = async () => {
    const name = window.prompt('Adapter name');
    if (!name) return;
    const endpoint = window.prompt('HTTPS endpoint URL');
    if (!endpoint) return;
    const credentialRef = window.prompt('Credential environment variable name (optional)', '') || null;
    try {
      await createAdapter({ id: `adapter-${crypto.randomUUID()}`, kind: 'http', endpoint, credential_ref: credentialRef, promised_stages: [], provides_answer: true, idempotent: false, timeout_seconds: 60 });
      await refresh(); showToast({ type: 'success', title: 'Adapter registered', message: name });
    } catch (error) { showToast({ type: 'error', title: 'Registration failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold font-mono text-white">RAG Application Adapters</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Registered HTTP endpoints and SDK connectors to evaluate external production RAG pipelines against controlled test suites.
          </p>
        </div>

        <StButton
          label="Register New Adapter"
          icon={<Plus className="w-4 h-4" />}
          variant="primary"
          onClick={registerAdapter}
          disabled={snapshot.user.role !== 'ADMIN'}
        />
      </div>

      {/* Adapters Table */}
      <div className="bg-[#15171e] rounded-lg border border-[#272a33] overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#191b22] border-b border-[#272a33] text-zinc-400 font-semibold font-mono text-[11px]">
              <th className="py-3 px-4 font-sans">Adapter Name</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Endpoint URL</th>
              <th className="py-3 px-3">Health Status</th>
              <th className="py-3 px-3">Last Verified</th>
              <th className="py-3 px-3 text-right">Runs</th>
              <th className="py-3 px-4 text-center font-sans">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242730]">
            {mockAdapters.map((adp) => (
              <tr 
                key={adp.id}
                onClick={() => setSelectedAdapter(adp)}
                className="hover:bg-[#191b22]/80 cursor-pointer transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-white font-sans">{adp.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{adp.id}</div>
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1e2129] text-zinc-300 font-mono">
                    {adp.type}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono text-zinc-400 text-[11px] max-w-xs truncate">
                  {adp.endpoint}
                </td>
                <td className="py-3 px-3">
                  <StBadge type="status" label={adp.healthStatus} />
                </td>
                <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                  {adp.lastVerified}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-zinc-200">
                  {adp.experimentsUsedIn}
                </td>
                <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onNavigate('new_experiment', { mode: 'adapter', adapterId: selectedAdapter?.id })}
                      className="px-2 py-1 rounded bg-[#251e1b] hover:bg-[#251e1b] text-[#ff7733] font-medium text-[11px]"
                    >
                      Evaluate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer Configuration Inspector */}
      {selectedAdapter && (
        <div className="fixed inset-0 bg-[#15171e]/40 z-50 flex justify-end backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#15171e] h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#272a33]">
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-[#ff7733]" />
                  <span className="font-bold text-sm text-white">{selectedAdapter.name}</span>
                </div>
                <button 
                  onClick={() => setSelectedAdapter(null)}
                  className="p-1 hover:bg-[#1e2129] rounded text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Endpoint URL</label>
                <div className="p-2.5 bg-[#191b22] rounded border border-[#272a33] font-mono text-xs text-zinc-200 mt-1">
                  {selectedAdapter.endpoint}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Request Body Mapping</label>
                <StCodeBlock
                  code={JSON.stringify(selectedAdapter.requestMapping, null, 2)}
                  language="json"
                  title="HTTP POST Payload"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Response JSON Extraction Mapping</label>
                <StCodeBlock
                  code={JSON.stringify(selectedAdapter.responseMapping, null, 2)}
                  language="json"
                  title="JMESPath / JSON Keys"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
                  <div className="text-[10px] text-zinc-500 font-sans font-semibold uppercase">Timeout</div>
                  <div className="font-bold text-zinc-200 mt-0.5">{selectedAdapter.timeoutSeconds} seconds</div>
                </div>
                <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
                  <div className="text-[10px] text-zinc-500 font-sans font-semibold uppercase">Retry Policy</div>
                  <div className="font-bold text-zinc-200 mt-0.5">{selectedAdapter.retryCount} attempts (Exp Backoff)</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#272a33] flex justify-end gap-2">
              <StButton
                label="Close"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAdapter(null)}
              />
              <StButton
                label="Benchmark Adapter"
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedAdapter(null);
                  onNavigate('new_experiment', { mode: 'adapter', adapterId: selectedAdapter?.id });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
