import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink, Code2 } from 'lucide-react';
import { ScreenId } from '../../types';
import { useToast } from '../../context/ToastContext';

interface StreamlitCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: ScreenId;
}

export const StreamlitCodeModal: React.FC<StreamlitCodeModalProps> = ({
  isOpen,
  onClose,
  currentScreen
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const pythonCodeTemplates: Record<string, string> = {
    overview: `# =========================================================
# RAGGUAGE: Streamlit Implementation (Screen 01: Overview)
# =========================================================
import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(page_title="RAGGUAGE — Overview", layout="wide")

st.title("RAG Benchmarking & Evaluation Dashboard")
st.caption("Active Benchmark Suite: Customer Support Production v3.2")

# Top KPI Metric Row
col1, col2, col3, col4, col5 = st.columns(5)
with col1:
    st.metric(label="Retrieval Recall@10", value="0.842", delta="+0.041")
with col2:
    st.metric(label="Faithfulness", value="0.891", delta="+0.065")
with col3:
    st.metric(label="Answer Relevance", value="0.865", delta="+0.022")
with col4:
    st.metric(label="p95 Latency", value="1,180 ms", delta="-182 ms", delta_color="inverse")
with col5:
    st.metric(label="Cost / 1k Queries", value="$4.12", delta="-$0.45", delta_color="inverse")

st.divider()

# Quality vs Latency Pareto Frontier
st.subheader("Quality vs. Latency Pareto Frontier")
df = pd.DataFrame([
    {"run": "EXP-1042 (Hybrid+Rerank)", "latency": 1180, "score": 0.891, "status": "Candidate"},
    {"run": "EXP-1041 (Baseline BM25)", "latency": 1362, "score": 0.826, "status": "Baseline"},
    {"run": "EXP-1039 (Dense Only)", "latency": 920, "score": 0.785, "status": "Archived"},
    {"run": "EXP-1038 (Cohere Rerank)", "latency": 1840, "score": 0.904, "status": "Exploration"},
])

fig = px.scatter(df, x="latency", y="score", color="status", text="run",
                 labels={"latency": "p95 Latency (ms)", "score": "Composite Quality Score"},
                 title="Latency SLA (1500ms) vs Target Quality (0.85)")
st.plotly_chart(fig, use_container_width=True)

# Engineering Attention Ledger
st.subheader("Engineering Attention Ledger")
attention_data = [
    {"ID": "EXP-1042", "Category": "Cancellation Policies", "Issue": "14 Regressions detected", "Severity": "High"},
    {"ID": "DATA-004", "Category": "Billing Terms", "Issue": "3 missing expected chunk annotations", "Severity": "Medium"},
    {"ID": "ADAPT-02", "Category": "LangChain Local", "Issue": "Worker pool timeout > 4000ms", "Severity": "Low"},
]
st.dataframe(pd.DataFrame(attention_data), use_container_width=True)
`,
    pipeline_lab: `# =========================================================
# RAGGUAGE: Streamlit Implementation (Screen 13: Pipeline Lab)
# =========================================================
import streamlit as st

st.set_page_config(page_title="RAGGUAGE — Pipeline Lab", layout="wide")

st.title("Interactive RAG Pipeline Tuning Lab")
st.markdown("Tune retrieval and generation parameters in real-time.")

with st.sidebar:
    st.header("Pipeline Hyperparameters")
    chunk_size = st.slider("Chunk Size (tokens)", min_value=128, max_value=2048, value=512, step=64)
    chunk_overlap = st.slider("Chunk Overlap (tokens)", min_value=0, max_value=256, value=64, step=16)
    
    st.subheader("Hybrid Retrieval Weights")
    dense_weight = st.slider("Dense Semantic Weight (α)", 0.0, 1.0, 0.65, 0.05)
    sparse_weight = 1.0 - dense_weight
    st.info(f"Sparse BM25 Weight: {sparse_weight:.2f}")

    reranker_pool = st.selectbox("Reranking Model", ["bge-reranker-large", "cohere-rerank-v3", "none"])
    top_n = st.number_input("Top N Injected Chunks", min_value=1, max_value=20, value=5)

# Interactive Playground
query = st.text_input("Test Query", "How do refund credits roll over when switching from Enterprise to Pro?")
if st.button("Execute Pipeline Trace", type="primary"):
    with st.spinner("Executing retrieval & reranking..."):
        st.success("Retrieved 5 chunks in 482ms")
        st.json({
            "dense_hits": 15,
            "sparse_hits": 8,
            "reranked_top1_score": 0.892,
            "latency_ms": 482
        })
`,
    compare: `# =========================================================
# RAGGUAGE: Streamlit Implementation (Screen 10: Compare Runs)
# =========================================================
import streamlit as st
import pandas as pd

st.set_page_config(page_title="RAGGUAGE — Compare Runs", layout="wide")
st.title("Differential Benchmark Comparison")

col_a, col_b = st.columns(2)
with col_a:
    st.selectbox("Baseline Run", ["EXP-1041 (BM25 Baseline)", "EXP-1038 (Dense Only)"], index=0)
with col_b:
    st.selectbox("Candidate Run", ["EXP-1042 (Hybrid + BGE Rerank)", "EXP-1040 (Chunk 1024)"], index=0)

st.subheader("Configuration Diff Matrix")
diff_df = pd.DataFrame([
    {"Parameter": "Retriever", "Baseline": "BM25 Keyword", "Candidate": "Dense (BGE-base) + BM25 Hybrid", "Changed": True},
    {"Parameter": "Dense Weight (α)", "Baseline": "0.0", "Candidate": "0.65", "Changed": True},
    {"Parameter": "Reranker", "Baseline": "None", "Candidate": "bge-reranker-large", "Changed": True},
    {"Parameter": "Chunk Size", "Baseline": "512 tokens", "Candidate": "512 tokens", "Changed": False}
])
st.dataframe(diff_df, use_container_width=True)

# Metric Delta Breakdown
st.subheader("Evaluation Metric Deltas")
delta_col1, delta_col2, delta_col3 = st.columns(3)
with delta_col1:
    st.metric("Recall@10", "0.842", "+0.041")
with delta_col2:
    st.metric("Faithfulness", "0.891", "+0.065")
with delta_col3:
    st.metric("Regressions", "14 cases", "-8 vs v1", delta_color="inverse")
`
  };

  const code = pythonCodeTemplates[currentScreen] || pythonCodeTemplates.overview;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast({
      type: 'success',
      title: 'Python code copied!',
      message: 'Pure Streamlit script copied to clipboard.'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-[#15171e] border border-[#272a33] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#22252c] bg-[#12141a]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#251b18] text-[#ff7733] border border-[#3e2720]">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Streamlit Python Implementation</span>
                <span className="text-[11px] px-2 py-0.2 rounded-md font-mono bg-[#1f222a] text-[#ff7733] border border-[#303440]">
                  {currentScreen}.py
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Pure Python code mirroring the UI using Streamlit widgets
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff5500] hover:bg-[#e04b00] text-white text-xs font-semibold shadow-xs shadow-orange-500/20 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Script'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f2229] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-[#0d0f12]">
          <pre className="text-zinc-200">
            <code>{code}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#101217] border-t border-[#22252c] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#ff5500]" />
            <span className="font-mono text-[11px]">Run: streamlit run app.py --server.port=3000</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Pure Streamlit 1.38+ compatible</span>
        </div>
      </div>
    </div>
  );
};
