import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Scale, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { StBadge, StButton, StTabs, StExpander, StCodeBlock } from '../components/ui/StreamlitComponents';
import { mockModels, mockJudgeProfiles } from '../mockData';
import { ScreenId } from '../types';
import { createModel, getConfiguration, updateConfiguration } from '../api';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

interface ModelsJudgesScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const ModelsJudgesScreen: React.FC<ModelsJudgesScreenProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('Primary LLMs');
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();

  const registerModel = async () => {
    const provider = window.prompt('Provider name (for example: openai)');
    if (!provider) return;
    const model = window.prompt('Provider model identifier');
    if (!model) return;
    const selectedRole = window.prompt('Role: GENERATOR, JUDGE, or ANALYST', 'GENERATOR')?.toUpperCase();
    if (!selectedRole || !['GENERATOR', 'JUDGE', 'ANALYST'].includes(selectedRole)) {
      showToast({ type: 'error', title: 'Invalid role', message: 'Choose GENERATOR, JUDGE, or ANALYST.' }); return;
    }
    const credentialRef = window.prompt('Credential environment variable name (optional)', '') || null;
    try {
      const id = `model-${crypto.randomUUID()}`;
      await createModel({ id, revision: 1, provider, model, model_revision: null, roles: [selectedRole], endpoint_type: 'provider_api', endpoint: null, credential_ref: credentialRef, enabled: true });
      const platform = await getConfiguration('platform');
      const allowKey = `models.allowed.${selectedRole}`;
      await updateConfiguration('platform', { ...platform.values, [allowKey]: [...new Set([...(platform.values[allowKey] || []), id])] }, platform.revision, `Allow newly registered ${selectedRole} model`);
      await refresh(); showToast({ type: 'success', title: 'Model registered', message: `${model} is available for ${selectedRole}.` });
    } catch (error) { showToast({ type: 'error', title: 'Registration failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold font-mono text-white">Models & Judge Rubrics</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Registered generative foundation models and calibrated Judge LLM evaluators with strict claim-level scoring rubrics.
          </p>
        </div>

        <StButton
          label="Register Model Profile"
          icon={<Plus className="w-4 h-4" />}
          variant="primary"
          onClick={registerModel}
          disabled={snapshot.user.role !== 'ADMIN'}
        />
      </div>

      {/* Tabs */}
      <StTabs
        tabs={['Primary LLMs', 'Judge LLMs', 'Cost vs Capability Matrix']}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab 1: Primary LLMs */}
      {activeTab === 'Primary LLMs' && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] overflow-hidden shadow-xs space-y-4">
          <div className="px-5 py-3.5 bg-[#191b22] border-b border-[#272a33] flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Registered Primary Generators
            </div>
            <span className="text-[11px] font-mono text-zinc-400">Models available for pipeline generation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-[#272a33] text-zinc-400 text-[11px]">
                  <th className="py-2.5 px-4 font-sans">Provider</th>
                  <th className="py-2.5 px-3">Model ID</th>
                  <th className="py-2.5 px-3 text-right">Context Window</th>
                  <th className="py-2.5 px-3 text-right">Input / 1M</th>
                  <th className="py-2.5 px-3 text-right">Output / 1M</th>
                  <th className="py-2.5 px-4 text-center font-sans">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242730]">
                {mockModels.map((m) => (
                  <tr key={m.id} className="hover:bg-[#191b22]">
                    <td className="py-3 px-4 font-sans font-semibold text-zinc-200">{m.provider}</td>
                    <td className="py-3 px-3 font-bold text-[#ff7733]">{m.id}</td>
                    <td className="py-3 px-3 text-right text-zinc-400">{(m.contextWindow || 128000).toLocaleString()} tok</td>
                    <td className="py-3 px-3 text-right text-zinc-300">{m.costInputPer1M == null ? 'Not recorded' : `$${m.costInputPer1M}`}</td>
                    <td className="py-3 px-3 text-right text-zinc-300">{m.costOutputPer1M == null ? 'Not recorded' : `$${m.costOutputPer1M}`}</td>
                    <td className="py-3 px-4 text-center font-sans">
                      <StBadge type="status" label={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Judge LLMs */}
      {activeTab === 'Judge LLMs' && (
        <div className="space-y-4">
          <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242730]">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Calibrated Judge Evaluator Profiles
              </div>
              <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Rubric Version: v2.4 (Strict Claim Extraction)
              </span>
            </div>

            <div className="divide-y divide-[#242730] space-y-4">
              {mockJudgeProfiles.map((j) => (
                <div key={j.id} className="pt-4 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StBadge type="judge" label={j.name} />
                      <span className="text-xs font-bold text-white font-mono">({j.model})</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">Temp: {j.temperature}</span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    {j.rubricDescription}
                  </p>

                  <StExpander title="Inspect Judge Rubric & System Prompt">
                    <StCodeBlock
                      code={`You are an objective AI evaluation judge. Given a candidate answer and a set of context passages, you must:\n1. Extract all factual assertions/claims made by the candidate answer.\n2. For each claim, check if it is directly supported by the context passages.\n3. Mark any unsupported or contradicted claims with high penalty.\n4. Output final score [0.0 to 1.0] along with detailed step-by-step reasoning.`}
                      language="markdown"
                      title="System Rubric"
                    />
                  </StExpander>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Matrix */}
      {activeTab === 'Cost vs Capability Matrix' && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-white">Registered model accounting</h3>
          <p className="text-xs text-zinc-400">
            Pricing is shown only when it was persisted with the model registration.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#191b22] border-b border-[#272a33] text-zinc-400 font-semibold font-mono">
                  <th className="py-2.5 px-3 font-sans">Profile</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Input / 1M</th>
                  <th className="py-2.5 px-3">Output / 1M</th>
                  <th className="py-2.5 px-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242730] font-mono">
                {mockModels.map(model => <tr key={model.id} className="hover:bg-[#191b22]"><td className="py-3 px-3 font-sans font-semibold text-white">{model.name}</td><td className="py-3 px-3 text-[#ff7733]">{model.model}</td><td className="py-3 px-3">{model.costInputPer1M == null ? 'Not recorded' : `$${model.costInputPer1M}`}</td><td className="py-3 px-3">{model.costOutputPer1M == null ? 'Not recorded' : `$${model.costOutputPer1M}`}</td><td className="py-3 px-3 font-sans">{model.role}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
