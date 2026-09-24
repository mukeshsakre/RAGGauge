# RAGGauge — Design System & Engineering Architecture
Reference inspiration: [inithabits.com](https://inithabits.com/)  
Implementation pattern: Pure Streamlit mental model (reproducible primitives, vertical density, contextual expanders, immutable state)

---

## 1. Product & Design Philosophy

RAGGauge is an engineering workbench for evaluating, benchmarking, comparing, diagnosing, and improving Retrieval-Augmented Generation (RAG) systems. It serves AI Engineers, RAG Engineers, ML Engineers, and Technical Architects.

### Core Principles
1. **Evidence Before Decoration**:
   Every visual element conveys empirical data. No decorative gradients, neon drop-shadows, or placeholder illustrations.
2. **Configuration Must Always Be Inspectable**:
   Every aggregate metric traces directly back to its exact pipeline configuration (chunk size, overlap, dense-sparse balance, reranker candidate pool, primary generator, and judge profile).
3. **Comparison as a First-Class Workflow**:
   Evaluating a single run is only half the engineering task; identifying differential deltas against an established baseline is the primary operational loop.
4. **Every Metric Supports Instant Drill-Down**:
   Clicking any metric or failure badge navigates down from macroscopic cluster performance to case-level execution traces.

---

## 2. Streamlit Primitive Mapping

Although prototyped in modern React + Vite, the visual hierarchy and layout rules strictly follow Streamlit's native design primitives:

| Streamlit Primitive | React Component | Visual Behavior |
|---------------------|-----------------|-----------------|
| `st.metric` | `<StMetric />` | Compact label, high-contrast monospace value, delta badge with directional green/red coloring |
| `st.tabs` | `<StTabs />` | Clean horizontal tabs with optional counter badges and active indigo indicators |
| `st.expander` | `<StExpander />` | Collapsible progressive disclosure container with clean borders and chevron |
| `st.dataframe` | Table with sticky headers | Dense, monospace numerical columns, aligned right for metrics, left for text |
| `st.code` | `<StCodeBlock />` | JetBrains Mono dark block with one-click copy and language tag |
| `st.badge` | `<StBadge />` | Distinct domain tags for models (blue), judges (purple), experiments (slate), and status |
| `st.alert` | `<StAlert />` | Subdued banner with informative icon (`info`, `warning`, `error`, `success`) |
| `st.sidebar` | `StreamlitShell` sidebar | 260px fixed navigation drawer with active state pills and workspace meta |

---

## 3. Typographic Scale & Rhythm

- **Display & Headings**: *Plus Jakarta Sans* / *IBM Plex Sans* — crisp, geometric sans-serif tuned for technical clarity and high legibility at 12–20px.
- **Data & Code**: *JetBrains Mono* — strictly aligned tabular figures (`font-variant-numeric: tabular-nums`) for metrics, latencies, tokens, and hashes.
- **Scale**:
  - Screen Titles: `1.25rem` (`20px`), weight: 700
  - Section Headers: `0.875rem` (`14px`), weight: 700, uppercase tracking
  - Body / Questions: `0.8125rem` (`13px`), line-height: 1.5
  - Captions / Meta: `0.6875rem` (`11px`), weight: 500, monospace

---

## 4. Color Semantics & Contrast

- **Canvas Background**: `#f8fafc` (Slate 50) — clean neutral light workspace
- **Containers & Cards**: `#ffffff` (White) with 1px border `#e2e8f0` (Slate 200) and subtle `shadow-2xs`
- **Primary Action**: `#4f46e5` (Indigo 600) — interactive controls and primary highlights
- **Success / Improvement**: `#059669` (Emerald 600) / `#ecfdf5` (Emerald 50)
- **Warning**: `#d97706` (Amber 600) / `#fffbeb` (Amber 50)
- **Regression / Failure**: `#e11d48` (Rose 600) / `#fff1f2` (Rose 50)
- **Judge / AI Evaluation**: `#7c3aed` (Purple 600) / `#faf5ff` (Purple 50)

---

## 5. Workflows Implemented

### Flow A: Evaluate Existing RAG Application (Screen 06 Mode A &rarr; Screen 07 &rarr; Screen 08)
Connect an external production endpoint via HTTP Adapter, verify schema compatibility, stream case evaluation, and view aggregate quality metrics.

### Flow B: Full Pipeline Optimization (Screen 13 &rarr; Screen 06 Mode B &rarr; Screen 08)
Configure chunking (Recursive 500/50), dense-sparse hybrid retrieval weights, and cross-encoder rerankers; run benchmarks against frozen datasets.

### Flow C: Compare & Diagnose Regressions (Screen 05 &rarr; Screen 10 &rarr; Screen 11 &rarr; Screen 09)
Multi-select baseline vs candidate runs, inspect isolated configuration diffs, view the 14 regressed cases, and inspect the claim-level verification trace.

### Flow D: Recommendation & Prescribed Next Iteration (Screen 11 &rarr; Screen 12 &rarr; Screen 13)
Analyze the latency-versus-quality trade-off ledger and load the recommended parameters (reducing reranker candidate window to 10) directly into Pipeline Lab.
