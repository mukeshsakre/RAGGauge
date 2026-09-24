import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Database,
  Table,
  Code
} from 'lucide-react';
import { StButton, StAlert, StBadge, StCodeBlock } from '../components/ui/StreamlitComponents';
import { ScreenId } from '../types';
import { parseDatasetFile } from '../utils/datasetImport';
import { createDataset } from '../api';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

interface CreateDatasetScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

export const CreateDatasetScreen: React.FC<CreateDatasetScreenProps> = ({ onNavigate }) => {
  const { refresh } = useRAGGauge();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [datasetName, setDatasetName] = useState('Enterprise API Billing & Tier Evaluation');
  const [datasetDesc, setDatasetDesc] = useState('Ground-truth benchmark for testing API usage thresholds, billing overages, and tier quotas.');
  const [sourceFormat, setSourceFormat] = useState<'jsonl' | 'csv' | 'json'>('jsonl');
  const [mappedFields, setMappedFields] = useState({
    case_id: 'id',
    question: 'query_text',
    ground_truth_answer: 'golden_answer',
    ground_truth_contexts: 'relevant_snippets',
    expected_document_ids: 'source_files',
    category: 'intent_cluster',
    difficulty: 'complexity'
  });
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [corpusVersion, setCorpusVersion] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [saving, setSaving] = useState(false);
  const emptyQuestions = records.filter(record => !String(record[mappedFields.question] || '').trim()).length;
  const contextCases = records.filter(record => {
    const value = record[mappedFields.ground_truth_contexts];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }).length;
  const categoryCount = new Set(records.map(record => String(record[mappedFields.category] || record.metadata?.category || 'Uncategorized'))).size;
  const validationPassed = records.length > 0 && emptyQuestions === 0;

  const parseFile = async (file: File) => {
    setImportError('');
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('The file exceeds the 50 MB limit.');
      const {records: parsed, corpusVersion: importedCorpus} = parseDatasetFile(await file.text(), sourceFormat);
      setCorpusVersion(importedCorpus);
      if ('question' in parsed[0]) setMappedFields({case_id:'id', question:'question', ground_truth_answer:'reference_answer', ground_truth_contexts:'ground_truth_contexts', expected_document_ids:'expected_document_ids', category:'category', difficulty:'difficulty'});
      setRecords(parsed);
      setFileName(file.name);
    } catch (error) {
      setRecords([]);
      setFileName('');
      setImportError(error instanceof Error ? error.message : 'Unable to parse the selected file.');
    }
  };

  const saveDataset = async () => {
    if (!datasetName.trim() || !records.length) {
      setImportError('Provide a dataset name and import at least one case.');
      return;
    }
    setSaving(true);
    try {
      const id = `dataset-${crypto.randomUUID()}`;
      const cases = records.map((record, index) => {
        const caseId = String(record[mappedFields.case_id] || `case-${index + 1}`);
        const question = String(record[mappedFields.question] || '').trim();
        if (!question) throw new Error(`Case ${caseId} has no mapped question.`);
        const contexts = record[mappedFields.ground_truth_contexts];
        const documents = record[mappedFields.expected_document_ids];
        const documentIds = Array.isArray(documents) ? documents.map(String) : documents ? [String(documents)] : [];
        return {
          id: caseId,
          question,
          reference_answer: record[mappedFields.ground_truth_answer] || null,
          ground_truth_contexts: Array.isArray(contexts) ? contexts.map(String) : contexts ? [String(contexts)] : null,
          relevance: record.relevance || (documentIds.length ? {
            level: 'document', labels: Object.fromEntries(documentIds.map(documentId => [documentId, 1])),
            graded: false, exhaustive: true, unjudged_as_irrelevant: false,
          } : null),
          evidence: record.evidence || [],
          metadata: {
            ...(record.metadata || {}),
            category: record[mappedFields.category] || record.metadata?.category || 'Uncategorized',
            difficulty: record[mappedFields.difficulty] || record.metadata?.difficulty || 'Medium',
            description: datasetDesc,
          },
        };
      });
      const created = await createDataset({ id, name: datasetName.trim(), version: 1, corpus_version: corpusVersion, cases });
      await refresh();
      showToast({ type: 'success', title: 'Dataset created', message: `${cases.length} cases persisted.` });
      onNavigate('dataset_detail', { datasetId: created.id });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Dataset creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Dataset Info' },
    { num: 2, label: 'Import Cases' },
    { num: 3, label: 'Map Fields' },
    { num: 4, label: 'Validate' },
    { num: 5, label: 'Create Version' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Stepper Header */}
      <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Create New Evaluation Dataset</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload, map, and validate your golden dataset to ensure reproducible RAG benchmarking.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#1e2129] text-zinc-300 font-semibold">
            Step {currentStep} of 5
          </span>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-5 gap-2 mt-5">
          {steps.map((s) => {
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div key={s.num} className="text-center">
                <div 
                  className={`h-1.5 rounded-full mb-1.5 transition-all ${
                    isDone ? 'bg-emerald-500' : isCurrent ? 'bg-[#ff5500]' : 'bg-[#272a33]'
                  }`}
                />
                <span className={`text-[11px] font-medium block truncate ${
                  isCurrent ? 'text-[#ff7733] font-bold' : isDone ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Dataset Info */}
      {currentStep === 1 && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-white">Dataset Metadata & Specification</h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Dataset Name *</label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full text-xs p-2.5 bg-[#191b22] border border-[#2e323e] rounded font-medium focus:outline-[#ff5500]"
              placeholder="e.g. Legal Contract Clauses v1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Description & Benchmark Purpose *</label>
            <textarea
              rows={3}
              value={datasetDesc}
              onChange={(e) => setDatasetDesc(e.target.value)}
              className="w-full text-xs p-2.5 bg-[#191b22] border border-[#2e323e] rounded focus:outline-[#ff5500] leading-relaxed"
              placeholder="Describe the target queries, expected document corpora, and domain nuances..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Initial Target Version</label>
              <input
                type="text"
                disabled
                value="v1.0 (Immutable)"
                className="w-full text-xs p-2.5 bg-[#1e2129] border border-[#272a33] rounded font-mono text-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Domain Tags</label>
              <input
                type="text"
                defaultValue="billing, api, enterprise-tier, golden"
                className="w-full text-xs p-2.5 bg-[#191b22] border border-[#2e323e] rounded font-mono text-xs focus:outline-[#ff5500]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Import Cases */}
      {currentStep === 2 && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Source Format & Upload</h2>
            <div className="flex gap-1">
              {(['jsonl', 'csv', 'json'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSourceFormat(fmt)}
                  className={`px-3 py-1 rounded text-xs font-mono font-medium uppercase transition-colors ${
                    sourceFormat === fmt ? 'bg-[#ff5500] text-white' : 'bg-[#1e2129] text-zinc-400 hover:bg-[#272a33]'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <label className="relative block border-2 border-dashed border-[#2e323e] rounded-lg p-8 text-center hover:border-[#ff5500] bg-[#191b22]/50 transition-colors cursor-pointer">
            <input type="file" accept={`.${sourceFormat}`} className="absolute inset-0 opacity-0 cursor-pointer" onChange={event => event.target.files?.[0] && parseFile(event.target.files[0])} />
            <Upload className="w-8 h-8 text-[#ff7733] mx-auto mb-2" />
            <div className="text-sm font-semibold text-zinc-200">
              Drag and drop your .{sourceFormat.toUpperCase()} file here, or click to browse
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Supports standard benchmark exports up to 50MB (max 10,000 cases)
            </div>
            <div className="mt-3 inline-block">
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-950/30 text-emerald-400 font-mono border border-emerald-200">
                {fileName ? `Loaded ${fileName} (${records.length} cases detected)` : 'No file selected'}
              </span>
            </div>
          </label>
          {importError && <StAlert type="error">{importError}</StAlert>}

          {/* Sample Raw Preview */}
          <div>
            <div className="text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
              <span>Detected Records (First 2 Lines Preview)</span>
              <span className="text-[11px] text-zinc-500 font-mono">{records.length} records parsed</span>
            </div>
            <StCodeBlock
              code={records.length ? records.slice(0, 2).map(record => JSON.stringify(record)).join('\n') : 'Select a file to preview parsed records.'}
              language="json"
              title="First 2 Lines (JSONL)"
            />
          </div>
        </div>
      )}

      {/* Step 3: Map Fields */}
      {currentStep === 3 && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white">Field Schema Mapping</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Map the columns detected in your upload to RAGGauge standard evaluation properties.
            </p>
          </div>

          <div className="divide-y divide-[#242730] text-xs">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-200">Case ID</span>
                <span className="text-rose-400 font-bold ml-1">*</span>
                <div className="text-zinc-500 text-[11px]">Unique identifier per evaluation case</div>
              </div>
              <select 
                value={mappedFields.case_id} onChange={e => setMappedFields({...mappedFields, case_id: e.target.value})} className="p-2 bg-[#191b22] border border-[#272a33] rounded-lg">
                <option value="">Not mapped</option>{[...new Set([...Object.keys(records[0] || {}), mappedFields.case_id] )].filter(Boolean).map(key => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-200">Question / Query</span>
                <span className="text-rose-400 font-bold ml-1">*</span>
                <div className="text-zinc-500 text-[11px]">The input query supplied to the RAG pipeline</div>
              </div>
              <select 
                value={mappedFields.question} onChange={e => setMappedFields({...mappedFields, question: e.target.value})} className="p-2 bg-[#191b22] border border-[#272a33] rounded-lg">
                <option value="">Not mapped</option>{[...new Set([...Object.keys(records[0] || {}), mappedFields.question] )].filter(Boolean).map(key => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-200">Ground Truth Answer</span>
                <span className="text-rose-400 font-bold ml-1">*</span>
                <div className="text-zinc-500 text-[11px]">Vetted factual answer used for Judge comparison</div>
              </div>
              <select 
                value={mappedFields.ground_truth_answer} onChange={e => setMappedFields({...mappedFields, ground_truth_answer: e.target.value})} className="p-2 bg-[#191b22] border border-[#272a33] rounded-lg">
                <option value="">Not mapped</option>{[...new Set([...Object.keys(records[0] || {}), mappedFields.ground_truth_answer] )].filter(Boolean).map(key => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-200">Ground Truth Contexts</span>
                <div className="text-zinc-500 text-[11px]">Exact source paragraphs required for Context Recall</div>
              </div>
              <select 
                value={mappedFields.ground_truth_contexts} onChange={e => setMappedFields({...mappedFields, ground_truth_contexts: e.target.value})} className="p-2 bg-[#191b22] border border-[#272a33] rounded-lg">
                <option value="">Not mapped</option>{[...new Set([...Object.keys(records[0] || {}), mappedFields.ground_truth_contexts] )].filter(Boolean).map(key => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-200">Category / Intent</span>
                <div className="text-zinc-500 text-[11px]">Cluster for failure categorization</div>
              </div>
              <select 
                value={mappedFields.category} onChange={e => setMappedFields({...mappedFields, category: e.target.value})} className="p-2 bg-[#191b22] border border-[#272a33] rounded-lg">
                <option value="">Not mapped</option>{[...new Set([...Object.keys(records[0] || {}), mappedFields.category] )].filter(Boolean).map(key => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Validate */}
      {currentStep === 4 && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Pre-Commit Validation Report</h2>
            <StBadge type="status" label={validationPassed ? "Validation Passed" : "Validation Required"} />
          </div>

          <StAlert type="success">
            <strong>{records.length} cases</strong> parsed. Required mapped fields are validated when the version is created.
          </StAlert>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
              <div className="text-zinc-400">Valid Records</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{records.length - emptyQuestions}</div>
            </div>
            <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
              <div className="text-zinc-400">Empty Questions</div>
              <div className="text-lg font-bold font-mono text-zinc-200">{emptyQuestions}</div>
            </div>
            <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
              <div className="text-zinc-400">Context Coverage</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{records.length ? `${Math.round(contextCases / records.length * 100)}%` : '—'}</div>
            </div>
            <div className="p-3 bg-[#191b22] rounded border border-[#272a33]">
              <div className="text-zinc-400">Categories</div>
              <div className="text-lg font-bold font-mono text-[#ff7733]">{categoryCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Create Version */}
      {currentStep === 5 && (
        <div className="bg-[#15171e] rounded-lg border border-[#272a33] p-6 shadow-xs space-y-5 text-center py-10">
          <div className="w-12 h-12 bg-emerald-950/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Ready to Commit Immutable Version v1.0</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            {datasetName} will be committed with {records.length} imported cases. Once created and evaluated, this version cannot be modified in place.
          </p>

          <div className="max-w-md mx-auto p-3 bg-[#191b22] rounded border border-[#272a33] text-xs font-mono text-zinc-300 text-left space-y-1">
            <div><strong>Name:</strong> {datasetName}</div>
            <div><strong>Version:</strong> v1.0</div>
            <div><strong>Total Cases:</strong> {records.length}</div>
            <div><strong>Identity:</strong> Assigned when persisted</div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <StButton
              label={saving ? "Saving dataset…" : "Save and Open Dataset Detail"}
              variant="primary"
              size="md"
              disabled={saving || !validationPassed}
              onClick={saveDataset}
            />
          </div>
        </div>
      )}

      {importError && <StAlert type="error">{importError}</StAlert>}
      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <StButton
          label="Back"
          icon={<ArrowLeft className="w-4 h-4" />}
          variant="secondary"
          size="sm"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
        />

        {currentStep < 5 && (
          <StButton
            label="Next Step"
            icon={<ArrowRight className="w-4 h-4" />}
            variant="primary"
            size="sm"
            onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
          />
        )}
      </div>
    </div>
  );
};
