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
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [saving, setSaving] = useState(false);
  const emptyQuestions = records.filter(record => !String(record[mappedFields.question] || '').trim()).length;
  const contextCases = records.filter(record => {
    const value = record[mappedFields.ground_truth_contexts];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }).length;
  const categoryCount = new Set(records.map(record => String(record[mappedFields.category] || 'Uncategorized'))).size;
  const validationPassed = records.length > 0 && emptyQuestions === 0;

  const parseFile = async (file: File) => {
    setImportError('');
    try {
      const text = await file.text();
      let parsed: Record<string, any>[];
      if (sourceFormat === 'json') {
        const value = JSON.parse(text);
        parsed = Array.isArray(value) ? value : value.cases;
      } else if (sourceFormat === 'jsonl') {
        parsed = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      } else {
        const rows = text.split(/\r?\n/).filter(Boolean).map(row => row.split(',').map(cell => cell.trim()));
        const headers = rows.shift() || [];
        parsed = rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
      }
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('The file contains no cases.');
      if (parsed.length > 10000) throw new Error('The file exceeds the 10,000 case limit.');
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
          relevance: documentIds.length ? {
            level: 'document', labels: Object.fromEntries(documentIds.map(documentId => [documentId, 1])),
            graded: false, exhaustive: true, unjudged_as_irrelevant: false,
          } : null,
          evidence: [],
          metadata: {
            category: record[mappedFields.category] || 'Uncategorized',
            difficulty: record[mappedFields.difficulty] || 'Medium',
            description: datasetDesc,
          },
        };
      });
      const created = await createDataset({ id, name: datasetName.trim(), version: 1, corpus_version: null, cases });
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Stepper Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Create New Evaluation Dataset</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload, map, and validate your golden dataset to ensure reproducible RAG benchmarking.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold">
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
                    isDone ? 'bg-emerald-500' : isCurrent ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
                <span className={`text-[11px] font-medium block truncate ${
                  isCurrent ? 'text-indigo-700 font-bold' : isDone ? 'text-emerald-700' : 'text-slate-400'
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
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <h2 className="text-sm font-bold text-slate-900">Dataset Metadata & Specification</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dataset Name *</label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded font-medium focus:outline-indigo-500"
              placeholder="e.g. Legal Contract Clauses v1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Benchmark Purpose *</label>
            <textarea
              rows={3}
              value={datasetDesc}
              onChange={(e) => setDatasetDesc(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded focus:outline-indigo-500 leading-relaxed"
              placeholder="Describe the target queries, expected document corpora, and domain nuances..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Target Version</label>
              <input
                type="text"
                disabled
                value="v1.0 (Immutable)"
                className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded font-mono text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Domain Tags</label>
              <input
                type="text"
                defaultValue="billing, api, enterprise-tier, golden"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:outline-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Import Cases */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Source Format & Upload</h2>
            <div className="flex gap-1">
              {(['jsonl', 'csv', 'json'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSourceFormat(fmt)}
                  className={`px-3 py-1 rounded text-xs font-mono font-medium uppercase transition-colors ${
                    sourceFormat === fmt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <label className="relative block border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 bg-slate-50/50 transition-colors cursor-pointer">
            <input type="file" accept={`.${sourceFormat}`} className="absolute inset-0 opacity-0 cursor-pointer" onChange={event => event.target.files?.[0] && parseFile(event.target.files[0])} />
            <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">
              Drag and drop your .{sourceFormat.toUpperCase()} file here, or click to browse
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Supports standard benchmark exports up to 50MB (max 10,000 cases)
            </div>
            <div className="mt-3 inline-block">
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-mono border border-emerald-200">
                {fileName ? `Loaded ${fileName} (${records.length} cases detected)` : 'No file selected'}
              </span>
            </div>
          </label>
          {importError && <StAlert type="error">{importError}</StAlert>}

          {/* Sample Raw Preview */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Detected Records (First 2 Lines Preview)</span>
              <span className="text-[11px] text-slate-400 font-mono">{records.length} records parsed</span>
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
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Field Schema Mapping</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Map the columns detected in your upload to RAGGauge standard evaluation properties.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-800">Case ID</span>
                <span className="text-rose-600 font-bold ml-1">*</span>
                <div className="text-slate-400 text-[11px]">Unique identifier per evaluation case</div>
              </div>
              <select 
                value={mappedFields.case_id}
                onChange={(e) => setMappedFields({ ...mappedFields, case_id: e.target.value })}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800"
              >
                <option value="id">id</option>
                <option value="case_id">case_id</option>
                <option value="uid">uid</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-800">Question / Query</span>
                <span className="text-rose-600 font-bold ml-1">*</span>
                <div className="text-slate-400 text-[11px]">The input query supplied to the RAG pipeline</div>
              </div>
              <select 
                value={mappedFields.question}
                onChange={(e) => setMappedFields({ ...mappedFields, question: e.target.value })}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800"
              >
                <option value="query_text">query_text</option>
                <option value="question">question</option>
                <option value="prompt">prompt</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-800">Ground Truth Answer</span>
                <span className="text-rose-600 font-bold ml-1">*</span>
                <div className="text-slate-400 text-[11px]">Vetted factual answer used for Judge comparison</div>
              </div>
              <select 
                value={mappedFields.ground_truth_answer}
                onChange={(e) => setMappedFields({ ...mappedFields, ground_truth_answer: e.target.value })}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800"
              >
                <option value="golden_answer">golden_answer</option>
                <option value="ground_truth">ground_truth</option>
                <option value="expected_answer">expected_answer</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-800">Ground Truth Contexts</span>
                <div className="text-slate-400 text-[11px]">Exact source paragraphs required for Context Recall</div>
              </div>
              <select 
                value={mappedFields.ground_truth_contexts}
                onChange={(e) => setMappedFields({ ...mappedFields, ground_truth_contexts: e.target.value })}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800"
              >
                <option value="relevant_snippets">relevant_snippets</option>
                <option value="golden_contexts">golden_contexts</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-800">Category / Intent</span>
                <div className="text-slate-400 text-[11px]">Cluster for failure categorization</div>
              </div>
              <select 
                value={mappedFields.category}
                onChange={(e) => setMappedFields({ ...mappedFields, category: e.target.value })}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800"
              >
                <option value="intent_cluster">intent_cluster</option>
                <option value="category">category</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Validate */}
      {currentStep === 4 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Pre-Commit Validation Report</h2>
            <StBadge type="status" label={validationPassed ? "Validation Passed" : "Validation Required"} />
          </div>

          <StAlert type="success">
            <strong>{records.length} cases</strong> parsed. Required mapped fields are validated when the version is created.
          </StAlert>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-500">Valid Records</div>
              <div className="text-lg font-bold font-mono text-emerald-700">{records.length - emptyQuestions}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-500">Empty Questions</div>
              <div className="text-lg font-bold font-mono text-slate-800">{emptyQuestions}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-500">Context Coverage</div>
              <div className="text-lg font-bold font-mono text-emerald-700">{records.length ? `${Math.round(contextCases / records.length * 100)}%` : '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-500">Categories</div>
              <div className="text-lg font-bold font-mono text-indigo-700">{categoryCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Create Version */}
      {currentStep === 5 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5 text-center py-10">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Ready to Commit Immutable Version v1.0</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {datasetName} will be committed with {records.length} imported cases. Once created and evaluated, this version cannot be modified in place.
          </p>

          <div className="max-w-md mx-auto p-3 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-700 text-left space-y-1">
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
