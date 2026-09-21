"""RAGGauge local workspace UI.

The UI is a thin client over the authenticated API. It renders persisted runs,
traces, metrics and comparisons; it never evaluates data in the browser.
"""

from __future__ import annotations

import html
import json
import os
from statistics import median

import httpx
import streamlit as st

st.set_page_config(
    page_title="RAGGauge · RAG evaluation lab",
    page_icon="◈",
    layout="wide",
    initial_sidebar_state="expanded",
)

BASE = os.environ.get("RAGGAUGE_API_URL", "http://127.0.0.1:8000").rstrip("/")


def inject_css():
    """One token sheet for the Streamlit shell, native controls and dashboard."""
    st.markdown(
        """
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root {
  --app:#0B1117; --sidebar:#0E161E; --surface:#121A22; --raised:#16202A;
  --hairline:#243140; --strong:#2E3F51;
  --text:#E8EEF4; --secondary:#9AA8B6; --muted:#6B7A88;
  --accent:#2EE6C5; --accent-dim:#1A3D38;
  --success:#3DDC97; --warning:#F0A202; --danger:#F07167;
  --table-header:#1A2430; --row-hover:#1C2834;
  --ui:"IBM Plex Sans",Inter,system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
  --page:24px; --card-pad:16px 18px; --gap:12px; --section:20px;
  --radius:10px; --control-radius:8px; --chip-radius:999px;
  --border:1px solid var(--hairline);
  --card-shadow:0 1px 0 rgba(255,255,255,0.03) inset,0 8px 24px rgba(0,0,0,0.28);
  --focus:0 0 0 2px #0B1117,0 0 0 4px #2EE6C5;
  --transition:120ms ease;
}
html,body,.stApp,[data-testid="stAppViewContainer"] {
  background:var(--app); color:var(--text); font-family:var(--ui);
}
[data-testid="stHeader"],[data-testid="stToolbar"],#MainMenu,footer,
[data-testid="stDecoration"],[data-testid="stStatusWidget"] {display:none!important;}
[data-testid="stElementContainer"]:has(style) {display:none;}
[data-testid="stMainBlockContainer"] {
  padding:var(--page); max-width:none;
}
[data-testid="stVerticalBlock"] {gap:var(--section);}
[data-testid="stHorizontalBlock"] {gap:var(--gap);}
[data-testid="stMarkdownContainer"],[data-testid="stWidgetLabel"],input,textarea,button {
  font-family:var(--ui); color:var(--text);
}
[data-testid="stMarkdownContainer"] p {line-height:1.5; margin:0;}
h1,h2,h3,h4 {color:var(--text); font-family:var(--ui); letter-spacing:0;}
h1 {font-size:24px!important; font-weight:600!important;}
h2 {font-size:18px!important; font-weight:600!important;}
[data-testid="stCaptionContainer"],.muted {color:var(--secondary);}
[data-testid="stSidebar"] {
  width:248px!important; min-width:248px!important; max-width:248px!important;
  position:sticky; top:0; height:100dvh; background:var(--sidebar);
  border-right:var(--border); box-shadow:none; transform:none!important;
}
[data-testid="stSidebarContent"] {background:var(--sidebar); padding:0; scrollbar-gutter:auto;}
[data-testid="stSidebarHeader"] {display:none;}
[data-testid="stSidebarUserContent"] {padding:16px 18px!important; width:100%!important; margin:0!important; box-sizing:border-box;}
[data-testid="stSidebarUserContent"] > div {padding:0!important;}
[data-testid="stSidebarCollapseButton"],[data-testid="stSidebarCollapsedControl"] {display:none;}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {gap:20px;}
.brand {display:flex; align-items:center; gap:8px; font-size:18px; font-weight:600;}
.brand-mark {
  width:28px; height:28px; flex-shrink:0; border:1px solid var(--accent);
  color:var(--accent); border-radius:50%; display:inline-grid; place-items:center;
}
.tagline,.sidebar-section {
  font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;
  color:var(--secondary);
}
.tagline {margin-top:8px; line-height:1.6;}
.sidebar-help {font-size:12px; line-height:1.6; color:var(--secondary);}
[data-testid="stSidebar"] [data-testid="stRadio"] > label p {
  font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;
  color:var(--secondary);
}
[data-testid="stSidebar"] [role="radiogroup"] {gap:4px;}
[data-testid="stSidebar"] [role="radiogroup"] > label {
  margin:0!important; min-height:36px; padding:0 12px;
  border-left:3px solid transparent; border-radius:0 8px 8px 0;
  transition:background var(--transition),border-color var(--transition);
}
[data-testid="stSidebar"] [role="radiogroup"] > label > div:first-child {display:none;}
[data-testid="stSidebar"] [role="radiogroup"] > label p {
  font:500 13px/36px var(--ui); color:var(--secondary);
}
[data-testid="stSidebar"] [role="radiogroup"] > label:hover {background:var(--raised);}
[data-testid="stSidebar"] [role="radiogroup"] > label:has(input:checked) {
  background:var(--raised); border-left-color:var(--accent);
}
[data-testid="stSidebar"] [role="radiogroup"] > label:has(input:checked) p {color:var(--accent);}
[data-testid="stSidebar"] [role="radiogroup"] > label:has(input:focus-visible) {box-shadow:var(--focus);}
[data-testid="stSidebar"] .st-key-workspace-page,
[data-testid="stSidebar"] [role="radiogroup"],
[data-testid="stSidebar"] [role="radiogroup"] > div {width:100%!important;}
[data-testid="stSidebar"] [data-testid="stRadioOption"] {
  width:100%; min-height:36px; padding:0 12px; margin:0;
  border-left:3px solid transparent; border-radius:0 8px 8px 0;
  transition:background var(--transition),border-color var(--transition);
}
[data-testid="stSidebar"] [data-testid="stRadioOption"] > div > div:first-child {display:none;}
[data-testid="stSidebar"] [data-testid="stRadioOption"] p {font:500 13px/36px var(--ui); color:var(--secondary);}
[data-testid="stSidebar"] [data-testid="stRadioOption"]:hover {background:var(--raised);}
[data-testid="stSidebar"] [data-testid="stRadioOption"][data-selected="true"] {background:var(--raised); border-left-color:var(--accent);}
[data-testid="stSidebar"] [data-testid="stRadioOption"][data-selected="true"] p {color:var(--accent);}
[data-testid="stSidebar"] [data-testid="stRadioOption"][data-focus-visible="true"] {box-shadow:var(--focus);}
.st-key-sidebar-footer {margin-top:32px;}
.topbar {
  height:56px; display:grid; grid-template-columns:160px minmax(0,1fr) 160px;
  gap:12px; align-items:center; border-bottom:var(--border); margin-bottom:16px;
}
.header-title {text-align:center; font-size:14px; font-weight:500; color:var(--text); min-width:0;}
.header-account {display:flex; justify-content:flex-end;}
.admin-chip {color:var(--secondary); background:transparent!important;}
.pill {
  display:inline-flex; align-items:center; gap:4px; border:1px solid currentColor;
  border-radius:var(--chip-radius); padding:3px 8px;
  font:600 11px/16px var(--ui); white-space:nowrap; vertical-align:middle;
}
.pill-green {color:var(--success); background:transparent;}
.pill-amber {color:var(--warning); background:transparent;}
.pill-red {color:var(--danger); background:transparent;}
.pill-gray {color:var(--secondary); background:transparent;}
div[class*="st-key-kpi-"],div[class*="st-key-rail-panel-"],
.card,[data-testid="stMetric"] {
  background:var(--surface); border:var(--border); border-radius:var(--radius);
  padding:var(--card-pad); box-shadow:var(--card-shadow);
}
div[class*="st-key-kpi-"] {min-height:118px; height:118px; overflow:hidden;}
div[class*="st-key-kpi-"] [data-testid="stVerticalBlock"] {gap:0;}
div[class*="st-key-rail-panel-"] {height:auto!important; min-height:128px;}
.eyebrow,.card-title,[data-testid="stMetricLabel"] {
  color:var(--secondary); font:600 11px/16px var(--ui);
  letter-spacing:.06em; text-transform:uppercase;
}
.kpi-value,.big-value,[data-testid="stMetricValue"] {
  font:600 30px/40px var(--mono); color:var(--accent);
  font-variant-numeric:tabular-nums;
}
.kpi-run {font-size:20px; line-height:20px; height:40px; display:flex; align-items:center; overflow-wrap:anywhere;}
.kpi-slot {height:40px; display:flex; align-items:center;}
/* The muted token is reserved for nonessential decoration: on the card surface
   it is 3.98:1. Secondary text gives readable captions a 7.23:1 contrast ratio. */
.kpi-caption {font:400 12px/18px var(--ui); color:var(--secondary);}
.kpi-missing-caption {color:var(--secondary);}
.coverage-banner,.alert-strip {
  background:var(--raised); border:var(--border); border-radius:var(--radius);
  border-left:3px solid var(--accent); padding:10px 14px;
  display:flex; align-items:center; flex-wrap:wrap; gap:8px;
  color:var(--secondary); font:500 13px/20px var(--ui);
}
.coverage-title {color:var(--text);}
.st-key-rail-stack {gap:12px;}
.st-key-rail-stack > [data-testid="stVerticalBlock"] {gap:12px;}
.rail-heading {height:24px; display:flex; justify-content:space-between; align-items:center;}
.rail-heading h2 {font:600 13px/20px var(--ui)!important; margin:0; padding:0;}
.live {display:inline-flex; align-items:center; gap:6px; font:600 10px/16px var(--ui); letter-spacing:.08em; text-transform:uppercase; color:var(--secondary);}
.live-dot {width:8px; height:8px; border-radius:50%; background:var(--accent);}
.rail-title {font:500 13px/20px var(--ui); color:var(--text); margin:12px 0 4px;}
.rail-copy {font:400 12px/18px var(--ui); color:var(--secondary);}
.rail-ready {font:600 22px/30px var(--ui); color:var(--accent); margin:8px 0 4px;}
.queue-item {padding-top:12px; margin-top:12px; border-top:var(--border);}
.queue-name {font:500 12px/20px var(--mono); overflow-wrap:anywhere;}
.queue-meta {font:400 12px/18px var(--ui); color:var(--secondary);}
.progress {height:8px; background:var(--strong); border-radius:8px; overflow:hidden; margin:12px 0 8px;}
.progress > div {height:100%; background:var(--accent);}
.section-head {display:flex; align-items:center; justify-content:space-between; gap:12px;}
.section-head h2,.section-head span {font:400 12px/20px var(--ui)!important; color:var(--secondary); margin:0; padding:0;}
.st-key-recent-table {gap:12px;}
.table-scroll {border:var(--border); border-radius:var(--radius); overflow-x:auto; box-shadow:none;}
.runs-table {border-collapse:collapse; width:100%; margin:0!important; color:var(--text); font:400 13px/20px var(--ui);}
.runs-table th {
  padding:10px 12px; font:600 12px/20px var(--ui);
  background:var(--table-header); color:var(--secondary); text-align:left;
  white-space:nowrap; border-bottom:var(--border);
}
.runs-table td {padding:10px 12px; border-bottom:var(--border); background:var(--surface);}
.runs-table tr:last-child td {border-bottom:0;}
.runs-table tr:hover td {background:var(--row-hover);}
.runs-table td {transition:background var(--transition);}
.runs-table .num {text-align:right; font-family:var(--mono); font-variant-numeric:tabular-nums; white-space:nowrap;}
.runs-table .run-id {font-family:var(--mono); font-size:12px; overflow-wrap:anywhere;}
.runs-table tr.selected td:first-child {box-shadow:inset 2px 0 0 var(--accent);}
.runs-table tr.selected td {background:var(--raised);}
.table-empty {padding:16px 18px; color:var(--secondary); font-size:13px;}
[data-testid="stDataFrame"] {
  border:var(--border); border-radius:var(--radius); box-shadow:none;
  overflow:hidden; color:var(--text); background:var(--surface);
}
[data-testid="stSelectbox"] [data-baseweb="select"] > div,
[data-testid="stTextInput"] [data-baseweb="input"],
[data-testid="stNumberInput"] [data-baseweb="input"],
[data-testid="stTextArea"] textarea,
[data-testid="stMultiSelect"] [data-baseweb="select"] > div {
  background:var(--raised); color:var(--text); border:1px solid var(--strong);
  border-radius:var(--control-radius); min-height:40px;
}
[data-testid="stSelectbox"] [data-baseweb="select"] svg {fill:var(--secondary);}
[data-testid="stSelectbox"] input,[data-testid="stTextInput"] input,
[data-testid="stTextArea"] textarea {color:var(--text); background:transparent; caret-color:var(--accent);}
[data-baseweb="popover"] [role="listbox"] {background:var(--raised); color:var(--text);}
[data-baseweb="popover"] [role="option"] {min-height:36px; color:var(--text);}
[data-baseweb="popover"] [role="option"]:hover {background:var(--row-hover);}
[data-testid="stWidgetLabel"] p {font-size:12px; color:var(--secondary);}
[data-testid="stButton"] button,[data-testid="stDownloadButton"] button,
[data-testid="stFormSubmitButton"] button {
  min-height:40px; border-radius:var(--control-radius);
  border:1px solid var(--strong); background:var(--raised); color:var(--text);
  font:500 13px/20px var(--ui); transition:background var(--transition),border-color var(--transition);
}
[data-testid="stButton"] button p,[data-testid="stFormSubmitButton"] button p {font:500 13px/20px var(--ui); color:inherit;}
button[kind="primary"],button[kind="primaryFormSubmit"] {
  background:var(--accent-dim)!important; color:var(--accent)!important;
  border:1px solid var(--accent)!important;
}
[data-testid="stButton"] button:hover,[data-testid="stFormSubmitButton"] button:hover {border-color:var(--accent); background:var(--row-hover);}
button:focus-visible,[data-baseweb="select"]:focus-within,
[data-baseweb="input"]:focus-within,textarea:focus-visible {
  outline:none!important; box-shadow:var(--focus)!important; border-radius:var(--control-radius);
}
button:disabled {opacity:.6;}
[data-testid="stSelectbox"] [role="group"] {
  height:40px; min-height:40px; border:1px solid var(--strong);
  border-radius:8px; background:var(--raised); color:var(--text);
}
[data-testid="stSelectbox"] [role="combobox"] {
  font:400 13px/20px var(--ui); color:var(--text); background:transparent;
}
[data-testid="stSelectbox"] button {min-height:36px; min-width:36px; color:var(--secondary); background:transparent;}
[data-testid="stSelectbox"] [role="group"]:focus-within {box-shadow:var(--focus);}
[role="listbox"],[role="option"] {background:var(--raised); color:var(--text); font-family:var(--ui);}
[role="option"] {min-height:36px;}
[role="option"][data-focused="true"],[role="option"]:hover {background:var(--row-hover);}
.section-head h1 {margin:0;}
.trace-box {background:var(--surface); border:var(--border); border-radius:10px; padding:16px 18px; margin-bottom:12px;}
.trace-rank {display:inline-grid; place-items:center; min-width:28px; height:28px; border:var(--border); border-radius:8px; margin-right:8px; font-family:var(--mono);}
.trace-title {color:var(--text); font-weight:600;}
.trace-text {color:var(--secondary); font-size:13px; line-height:1.6; overflow-wrap:anywhere;}
.evidence {font:400 12px/18px var(--mono); color:var(--secondary);}
.delta-up {color:var(--success);} .delta-down {color:var(--danger);} .delta-neutral {color:var(--secondary);}
.st-key-login-shell {max-width:480px; margin:64px auto; padding:24px; border:var(--border); border-radius:10px; background:var(--surface);}
@media(max-width:1000px) {
  .topbar {grid-template-columns:36px minmax(0,1fr) 64px;}
  .header-brand-name {display:none;}
  .header-title {font-size:12px;}
  .kpi-value {font-size:28px;}
  .kpi-run {font-size:20px;}
}
@media(max-width:700px) {
  [data-testid="stSidebar"] {position:relative!important;}
  .topbar {height:auto; min-height:56px;}
  [data-testid="stHorizontalBlock"] {flex-wrap:wrap;}
  [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {min-width:200px!important; flex:1 1 100%!important;}
}
</style>
        """,
        unsafe_allow_html=True,
    )


def api(method: str, path: str, **kwargs):
    headers = {}
    token = st.session_state.get("token")
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        response = httpx.request(
            method, BASE + path, headers=headers, timeout=60, trust_env=False, **kwargs
        )
        if response.is_error:
            try:
                detail = response.json().get("detail", "Request failed")
            except ValueError:
                detail = response.text or "Request failed"
            st.error(detail)
            st.stop()
        return response
    except httpx.RequestError as exc:
        st.error(f"Cannot reach the RAGGauge API at {BASE}.")
        st.caption(f"Connection detail: {exc}")
        st.stop()


def esc(value) -> str:
    return html.escape(str(value))


def score(value, digits: int = 2) -> str:
    return "—" if value is None else f"{value:.{digits}f}"


def delta(value, digits: int = 2) -> str:
    return "—" if value is None else f"{value:+.{digits}f}"


def status_class(status: str) -> str:
    status = (status or "").upper()
    if status in {"COMPLETED", "SUCCEEDED", "SUCCESS", "AVAILABLE"}:
        return "pill-green"
    if "ERROR" in status or status in {"FAILED", "ERROR"}:
        return "pill-red"
    if status in {"RUNNING", "PENDING", "QUEUED", "DETECTED"}:
        return "pill-amber"
    return "pill-gray"


def pill(status: str) -> str:
    return f'<span class="pill {status_class(status)}">{esc(status)}</span>'


def run_metric_values(run: dict) -> dict[str, list[float]]:
    values: dict[str, list[float]] = {}
    for case in run.get("cases", []):
        for metric in case.get("metrics", []):
            if metric.get("status") == "SUCCESS" and metric.get("score") is not None:
                values.setdefault(metric["name"], []).append(float(metric["score"]))
    return values


def aggregate_metric(run: dict, names: tuple[str, ...]) -> float | None:
    values = run_metric_values(run)
    for name in names:
        if values.get(name):
            return sum(values[name]) / len(values[name])
    return None


def run_latency(run: dict) -> float | None:
    values = []
    for case in run.get("cases", []):
        latency = (case.get("trace") or {}).get("total_latency") or {}
        if latency.get("value") is not None:
            values.append(float(latency["value"]))
    return median(values) if values else None


def coverage(run: dict) -> tuple[int, int, int]:
    not_evaluated = errors = total = 0
    for case in run.get("cases", []):
        for metric in case.get("metrics", []):
            total += 1
            not_evaluated += metric.get("status") == "NOT_EVALUATED"
            errors += metric.get("status") == "ERROR"
    return not_evaluated, errors, total


def run_config_label(run: dict) -> str:
    cfg = (run.get("effective_configuration") or {}).get("values", {})
    retrieval = cfg.get("retrieval", {})
    strategy = retrieval.get("strategy", "external")
    dense = (retrieval.get("dense") or {}).get("top_k")
    return f"{strategy} · top_k {dense}" if dense else strategy


def topbar(user: dict, datasets: list[dict], runs: list[dict]):
    dataset_label = "No dataset selected"
    if datasets:
        dataset = datasets[0]
        dataset_label = (
            f"{dataset.get('name', 'dataset')} · v{dataset.get('version', '?')}"
        )
    st.markdown(
        f'<header class="topbar"><div class="brand">'
        f'<span class="brand-mark" aria-hidden="true">◈</span>'
        f'<span class="header-brand-name">RAGGauge</span></div>'
        f'<div class="header-title">{esc(dataset_label)} · {len(runs)} runs</div>'
        f'<div class="header-account"><span class="pill admin-chip">'
        f"{esc(user.get('role', 'USER'))}</span></div></header>",
        unsafe_allow_html=True,
    )


def card(title: str, value: str, subtitle: str = "", tone: str = ""):
    """Shared card used by the existing run and comparison screens."""
    with st.container():
        st.markdown(
            f'<div class="card"><div class="card-title">{esc(title)}</div>'
            f'<div class="big-value {esc(tone or "delta-neutral")}">{esc(value)}</div>'
            f'<div class="muted">{esc(subtitle)}</div></div>',
            unsafe_allow_html=True,
        )


def sidebar(user: dict) -> tuple[str, bool]:
    pages = ["Dashboard", "Datasets", "Experiments", "Runs", "Comparisons"]
    if user.get("role") == "ADMIN":
        pages.append("Administration")
    # Apply navigation before creating the widget so drill-down survives reruns.
    requested_page = st.session_state.pop("page_override", None)
    if requested_page in pages:
        st.session_state["workspace-page"] = requested_page
    with st.sidebar:
        st.markdown(
            '<div class="brand"><span class="brand-mark" aria-hidden="true">◈</span>'
            'RAGGauge</div><div class="tagline">LOCAL-FIRST RAG EVALUATION LAB</div>',
            unsafe_allow_html=True,
        )
        page = st.radio("Workspace", pages, key="workspace-page")
        with st.container(key="sidebar-footer"):
            st.markdown(
                '<div class="sidebar-help">Comparisons use paired SUCCESS cases only.'
                "<br/>Trace evidence remains available for drill-down.</div>",
                unsafe_allow_html=True,
            )
            if st.button("Sign out", use_container_width=True):
                api("DELETE", "/sessions/current")
                st.session_state.clear()
                st.rerun()
    return page, user.get("role") in {"ADMIN", "ENGINEER"}


def login():
    with st.container(key="login-shell"):
        st.title("RAGGauge")
        st.caption(
            "Measure retrieval, generation and evaluation evidence in one workspace."
        )
        with st.form("login"):
            username = st.text_input("Username", placeholder="admin")
            password = st.text_input("Password", type="password")
            if st.form_submit_button(
                "Sign in", use_container_width=True, type="primary"
            ):
                st.session_state.token = api(
                    "POST",
                    "/sessions",
                    json={"username": username, "password": password},
                ).json()["token"]
                st.rerun()


def kpi_row(latest: dict):
    recall = aggregate_metric(latest, ("recall@10", "recall@5"))
    faithfulness = aggregate_metric(latest, ("faithfulness",))
    latency = run_latency(latest)
    items = [
        (
            "Last completed run",
            latest.get("id", "No runs"),
            run_config_label(latest),
            "kpi-run",
        ),
        ("Recall", score(recall), f"{len(latest.get('cases', []))} cases", ""),
        (
            "Faithfulness",
            score(faithfulness),
            "eligible generated answers"
            if faithfulness is not None
            else "not available",
            "",
        ),
        (
            "Median latency",
            f"{latency:.0f} ms" if latency is not None else "—",
            "application wall time",
            "",
        ),
    ]
    for index, (column, item) in enumerate(zip(st.columns(4, gap="small"), items)):
        title, value, caption, value_class = item
        with column, st.container(key=f"kpi-{index}"):
            missing = title == "Faithfulness" and faithfulness is None
            display = (
                '<div class="kpi-slot"><span class="pill pill-amber">Not in this run</span></div>'
                if missing
                else f'<div class="kpi-value {value_class}" title="{esc(value)}">{esc(value)}</div>'
            )
            st.markdown(
                f'<div class="eyebrow">{esc(title)}</div>{display}'
                f'<div class="kpi-caption{" kpi-missing-caption" if missing else ""}">{esc(caption)}</div>',
                unsafe_allow_html=True,
            )


def coverage_banner(runs: list[dict]):
    counts = [coverage(run) for run in runs]
    not_evaluated = sum(item[0] for item in counts)
    errors = sum(item[1] for item in counts)
    st.markdown(
        '<div class="coverage-banner" role="status">'
        '<span class="coverage-title">Coverage watch</span>'
        f'<span class="pill pill-amber">{not_evaluated} NOT_EVALUATED</span>'
        '<span aria-hidden="true">·</span>'
        f'<span class="pill pill-red">{errors} ERROR</span>'
        '<span aria-hidden="true">·</span>'
        "<span>only eligible evidence contributes to metric means.</span></div>",
        unsafe_allow_html=True,
    )


def recent_runs(runs: list[dict]):
    ordered = list(reversed(runs))
    ids = [run["id"] for run in ordered]
    current = st.session_state.get("dashboard-run")
    if ids and current not in ids:
        st.session_state["dashboard-run"] = ids[0]
    selected = st.session_state.get("dashboard-run")
    with st.container(key="recent-table", width="stretch"):
        if ordered:
            rows = []
            for run in ordered:
                not_evaluated, errors, total = coverage(run)
                latency = run_latency(run)
                selected_class = ' class="selected"' if run["id"] == selected else ""
                rows.append(
                    f'<tr{selected_class}><td class="run-id">{esc(run["id"])}</td>'
                    f"<td>{esc(run_config_label(run))}</td>"
                    f"<td>{pill(run.get('status', 'UNKNOWN'))}</td>"
                    f'<td class="num">{total - not_evaluated - errors}/{total}</td>'
                    f'<td class="num">{score(aggregate_metric(run, ("recall@10", "recall@5")))}</td>'
                    f'<td class="num">{f"{latency:.0f} ms" if latency is not None else "—"}</td></tr>'
                )
            # Streamlit renders this accessible table directly. st.dataframe's
            # canvas cannot render CSS status pills or a selected-row left border.
            # It is container-width with no index and contains only actual rows.
            st.markdown(
                '<div class="table-scroll"><table class="runs-table" aria-label="Recent runs">'
                '<thead><tr><th scope="col">Run</th><th scope="col">Configuration</th>'
                '<th scope="col">Status</th><th scope="col" class="num">Eligible metrics</th>'
                '<th scope="col" class="num">Recall</th><th scope="col" class="num">Latency</th>'
                "</tr></thead><tbody>" + "".join(rows) + "</tbody></table></div>",
                unsafe_allow_html=True,
            )
            st.selectbox("Open run", ids, key="dashboard-run")
            if st.button("Open run drill-down", key="open-run", type="primary"):
                st.session_state.selected_run = st.session_state["dashboard-run"]
                st.session_state.page_override = "Runs"
                st.rerun()
        else:
            st.markdown(
                '<div class="table-scroll table-empty">No runs</div>',
                unsafe_allow_html=True,
            )


def rail(jobs: list[dict]):
    with st.container(key="rail-stack"):
        with st.container(key="rail-panel-queue"):
            st.markdown(
                '<div class="rail-heading"><h2>Queue</h2>'
                '<span class="live"><span class="live-dot" aria-hidden="true"></span>live</span></div>',
                unsafe_allow_html=True,
            )
            active = [
                job for job in jobs if job.get("status") in {"PENDING", "RUNNING"}
            ]
            if not active:
                st.markdown(
                    '<div class="rail-title">No active jobs</div>'
                    '<div class="rail-copy">Queued pipeline executions will appear here.</div>',
                    unsafe_allow_html=True,
                )
            for job in active[:4]:
                completed = job.get("completed_cases", 0)
                total = job.get("total_cases")
                progress = min(100, max(0, completed / max(total or 1, 1) * 100))
                st.markdown(
                    f'<div class="queue-item"><div class="queue-name">{esc(job.get("experiment_id", job["id"]))}</div>'
                    f"{pill(job.get('status', 'PENDING'))}"
                    f'<div class="progress"><div style="width:{progress:.0f}%"></div></div>'
                    f'<div class="queue-meta">{esc(completed)} / {esc(total if total is not None else "?")} cases</div></div>',
                    unsafe_allow_html=True,
                )
        with st.container(key="rail-panel-preflight"):
            st.markdown(
                '<div class="rail-heading"><h2>Preflight</h2></div>'
                '<div class="rail-ready">Ready</div>'
                '<div class="rail-copy">Metrics run only when their required evidence is present. '
                "Missing answers or context remain explicitly ineligible.</div>",
                unsafe_allow_html=True,
            )


def dashboard(user: dict):
    datasets = api("GET", "/datasets").json()
    runs = api("GET", "/runs").json()
    jobs = api("GET", "/jobs").json()
    topbar(user, datasets, runs)
    completed = [
        run
        for run in runs
        if run.get("status") in {"COMPLETED", "COMPLETED_WITH_ERRORS"}
    ]
    latest = completed[-1] if completed else (runs[-1] if runs else {})
    kpi_row(latest)
    coverage_banner(runs)
    with st.columns([7, 3], gap="small")[0]:
        st.markdown(
            '<div class="section-head"><h2>Recent runs</h2>'
            "<span>Latest persisted executions</span></div>",
            unsafe_allow_html=True,
        )
    main, right = st.columns([7, 3], gap="small")
    with main:
        recent_runs(runs)
    with right:
        rail(jobs)


def datasets_page(can_write: bool):
    st.markdown(
        '<div class="section-head"><h1>Datasets & corpora</h1><span>Versioned evaluation evidence</span></div>',
        unsafe_allow_html=True,
    )
    datasets = api("GET", "/datasets").json()
    corpora = api("GET", "/corpora").json()
    st.markdown(
        f'<div class="alert-strip">{len(datasets)} dataset versions &nbsp;·&nbsp; {len(corpora)} corpus versions &nbsp;·&nbsp; stable source evidence is preserved across rechunking.</div>',
        unsafe_allow_html=True,
    )
    if datasets:
        st.dataframe(
            [
                {
                    "Name": dataset.get("name"),
                    "Version": dataset.get("version"),
                    "Cases": len(dataset.get("cases", [])),
                    "ID": dataset.get("id"),
                }
                for dataset in datasets
            ],
            use_container_width=True,
            hide_index=True,
        )
    for corpus in corpora:
        with st.expander(
            f"{corpus.get('name')} · {len(corpus.get('documents', []))} documents"
        ):
            st.json(corpus)
    if can_write:
        with st.expander("Import a dataset or corpus", expanded=False):
            uploaded = st.file_uploader("Dataset JSON", type="json")
            if uploaded and st.button("Create dataset version"):
                api("POST", "/datasets", json=json.load(uploaded))
                st.rerun()
            corpus_name = st.text_input("Corpus name")
            documents = st.file_uploader(
                "Text or Markdown documents",
                type=["txt", "md"],
                accept_multiple_files=True,
            )
            if documents and st.button("Create corpus version"):
                api(
                    "POST",
                    "/corpora",
                    json={
                        "name": corpus_name or "Imported corpus",
                        "documents": [
                            {"id": file.name, "text": file.getvalue().decode("utf-8")}
                            for file in documents
                        ],
                    },
                )
                st.rerun()


def experiments_page(can_write: bool):
    st.markdown(
        '<div class="section-head"><h1>Experiments</h1><span>Immutable configuration definitions</span></div>',
        unsafe_allow_html=True,
    )
    experiments = api("GET", "/experiments").json()
    corpora = api("GET", "/corpora").json()
    datasets = api("GET", "/datasets").json()
    models = api("GET", "/models").json()
    effective = api("GET", "/configuration/effective").json()["values"]
    if experiments:
        st.dataframe(
            [
                {
                    "Experiment": experiment.get("name"),
                    "Status": experiment.get("status"),
                    "Dataset": experiment.get("dataset_version"),
                    "Corpus": experiment.get("corpus_version") or "external",
                    "ID": experiment.get("id"),
                }
                for experiment in experiments
            ],
            use_container_width=True,
            hide_index=True,
        )
    if can_write and datasets:
        with st.expander("Create experiment", expanded=not experiments):
            with st.form("experiment"):
                name = st.text_input("Experiment name")
                dataset = st.selectbox(
                    "Dataset version",
                    datasets,
                    format_func=lambda item: f"{item.get('name')} · {item.get('id')}",
                )
                corpus = st.selectbox(
                    "Corpus (optional)",
                    [None] + corpora,
                    format_func=lambda item: (
                        item.get("name") if item else "External/imported outputs"
                    ),
                )
                strategies = [
                    strategy
                    for strategy in ["dense", "lexical", "hybrid"]
                    if effective.get("retrieval." + strategy)
                ]
                strategy = st.selectbox("Retrieval strategy", strategies or ["dense"])
                columns = st.columns(3)
                top_k = columns[0].number_input(
                    "Dense candidate K", min_value=1, value=20
                )
                lexical_k = columns[1].number_input(
                    "BM25 candidate K", min_value=1, value=20
                )
                final_k = columns[2].number_input("Final K", min_value=1, value=10)
                chunker = st.selectbox(
                    "Chunking", ["recursive", "fixed", "sliding", "semantic"]
                )
                chunk_size = st.number_input("Chunk size", min_value=1, value=500)
                overlap = st.number_input("Chunk overlap", min_value=0, value=50)
                metric_choices = [
                    "precision@5",
                    "recall@5",
                    "ndcg@5",
                    "precision@10",
                    "recall@10",
                    "ndcg@10",
                    "faithfulness",
                    "answer_relevance",
                    "factual_correctness",
                    "context_precision",
                    "context_recall",
                ]
                metrics = st.multiselect(
                    "Metrics",
                    [
                        metric
                        for metric in metric_choices
                        if effective.get("metric." + metric.split("@")[0])
                    ],
                    default=[
                        metric
                        for metric in metric_choices[:3]
                        if effective.get("metric." + metric.split("@")[0])
                    ],
                )
                generators = [
                    model
                    for model in models
                    if "GENERATOR" in model.get("roles", [])
                    and model.get("id") in effective.get("models.allowed.GENERATOR", [])
                ]
                judges = [
                    model
                    for model in models
                    if "JUDGE" in model.get("roles", [])
                    and model.get("id") in effective.get("models.allowed.JUDGE", [])
                ]
                generator = st.selectbox(
                    "Generator",
                    [None] + generators,
                    format_func=lambda item: (
                        item.get("model") if item else "Externally supplied"
                    ),
                )
                judge = st.selectbox(
                    "Judge",
                    [None] + judges,
                    format_func=lambda item: item.get("model") if item else "No judge",
                )
                if st.form_submit_button("Create experiment", type="primary"):
                    configuration = {
                        "retrieval": {
                            "strategy": strategy,
                            "dense": {"top_k": top_k},
                            "lexical": {"top_k": lexical_k},
                            "final_top_k": final_k,
                        },
                        "evaluation": {"metrics": metrics},
                    }
                    if corpus:
                        configuration.update(
                            {
                                "chunking": {
                                    "enabled": effective.get("pipeline.chunking", True),
                                    "strategy": chunker,
                                    "size": chunk_size,
                                    "overlap": overlap,
                                },
                                "context": {"max_characters": 12000},
                                "generation": {
                                    "enabled": generator is not None,
                                    "model_registration": generator.get("id")
                                    if generator
                                    else None,
                                },
                            }
                        )
                    if judge:
                        configuration["judge"] = {"model_registration": judge.get("id")}
                    api(
                        "POST",
                        "/experiments",
                        json={
                            "name": name,
                            "dataset_version": dataset["id"],
                            "corpus_version": corpus.get("id") if corpus else None,
                            "configuration": configuration,
                        },
                    )
                    st.rerun()
    st.markdown(
        '<div class="section-head"><h2>Execution queue</h2></div>',
        unsafe_allow_html=True,
    )
    jobs = api("GET", "/jobs").json()
    st.dataframe(
        [
            {
                "ID": job.get("id"),
                "Experiment": job.get("experiment_id"),
                "Status": job.get("status"),
                "Completed": f"{job.get('completed_cases', 0)}/{job.get('total_cases', '?')}",
            }
            for job in jobs
        ],
        use_container_width=True,
        hide_index=True,
    )


def runs_page():
    runs = api("GET", "/runs").json()
    st.markdown(
        '<div class="section-head"><h1>Runs</h1><span>Execution evidence and case drill-down</span></div>',
        unsafe_allow_html=True,
    )
    if not runs:
        st.info("No runs yet. Create an experiment or import normalized traces.")
        return
    labels = [run.get("id") for run in runs]
    default = (
        labels.index(st.session_state.get("selected_run"))
        if st.session_state.get("selected_run") in labels
        else len(labels) - 1
    )
    selected_id = st.selectbox("Run", labels, index=default)
    run = next(run for run in runs if run.get("id") == selected_id)
    st.session_state.selected_run = selected_id
    columns = st.columns(4)
    with columns[0]:
        card("Status", run.get("status", "—"), run_config_label(run))
    with columns[1]:
        card("Cases", str(len(run.get("cases", []))), "explicitly accounted for")
    with columns[2]:
        card(
            "Recall",
            score(aggregate_metric(run, ("recall@10", "recall@5"))),
            "successful metric results",
        )
    with columns[3]:
        card(
            "Median latency",
            f"{run_latency(run):.0f} ms" if run_latency(run) is not None else "—",
            "application wall time",
        )
    st.markdown(
        '<div class="section-head"><h2>Case explorer</h2><span>trace → metrics → evidence</span></div>',
        unsafe_allow_html=True,
    )
    cases = run.get("cases", [])
    if not cases:
        return
    case_labels = [f"{case.get('case_id')} · {case.get('status')}" for case in cases]
    selected_case = st.selectbox("Evaluation case", case_labels)
    case = cases[case_labels.index(selected_case)]
    trace = case.get("trace") or {}
    left, mid, right = st.columns([1.25, 1.25, 1])
    with left:
        st.markdown(
            '<div class="section-head"><h2>Retrieved evidence</h2></div>',
            unsafe_allow_html=True,
        )
        stages = trace.get("stages") or {}
        retrieval = next(
            (
                stages[key]
                for key in [
                    "DENSE_RETRIEVAL",
                    "FUSED_RETRIEVAL",
                    "RERANKED_RETRIEVAL",
                    "LEXICAL_RETRIEVAL",
                ]
                if key in stages
            ),
            {},
        )
        for index, candidate in enumerate(
            (retrieval or {}).get("candidates", [])[:8], 1
        ):
            document = candidate.get("document_id", "document")
            text = candidate.get("text", "")
            st.markdown(
                f'<div class="trace-box"><span class="trace-rank">{index}</span><span class="trace-title">{esc(document)}</span><div class="trace-text">{esc(text[:300])}</div></div>',
                unsafe_allow_html=True,
            )
        if not (retrieval or {}).get("candidates"):
            st.info("Retrieval candidates were not supplied by this trace.")
    with mid:
        st.markdown(
            '<div class="section-head"><h2>Generator context</h2></div>',
            unsafe_allow_html=True,
        )
        context_stage = stages.get("GENERATOR_CONTEXT") or {}
        context = context_stage.get("context") or []
        if isinstance(context, str):
            context = [context]
        if context:
            for index, item in enumerate(context, 1):
                text = item.get("text", "") if isinstance(item, dict) else str(item)
                st.markdown(
                    f'<div class="trace-box"><span class="trace-rank">{index}</span><span class="trace-title">Context item</span><div class="trace-text">{esc(text[:360])}</div></div>',
                    unsafe_allow_html=True,
                )
        else:
            st.info("Exact generator context is unavailable for this trace.")
    with right:
        st.markdown(
            '<div class="section-head"><h2>Answer & metrics</h2></div>',
            unsafe_allow_html=True,
        )
        answer = trace.get("generated_answer")
        st.markdown(
            f'<div class="trace-box"><div class="trace-title">Generated answer</div><div class="trace-text">{esc(answer or "No generated answer")}</div></div>',
            unsafe_allow_html=True,
        )
        for metric in case.get("metrics", []):
            value = (
                score(metric.get("score"))
                if metric.get("score") is not None
                else metric.get("status", "—")
            )
            st.markdown(
                f'<div class="card" style="padding:.7rem;margin-bottom:.45rem"><div class="card-title">{esc(metric.get("name"))} · {esc(metric.get("stage"))}</div><span class="big-value" style="font-size:1.3rem">{esc(value)}</span> {pill(metric.get("status", ""))}</div>',
                unsafe_allow_html=True,
            )
    st.markdown(
        '<div class="section-head"><h2>Pipeline timing</h2></div>',
        unsafe_allow_html=True,
    )
    timing = []
    for name, stage in stages.items():
        latency = stage.get("latency") or {}
        if latency.get("value") is not None:
            timing.append(
                {
                    "Stage": name,
                    "Latency": f"{latency['value']:.0f} ms",
                    "Provenance": latency.get("provenance", "unknown"),
                }
            )
    st.dataframe(timing, use_container_width=True, hide_index=True)
    with st.expander("Raw normalized trace"):
        st.json(trace)


def comparisons_page(can_write: bool):
    runs = api("GET", "/runs").json()
    comparisons = api("GET", "/comparisons").json()
    st.markdown(
        '<div class="section-head"><h1>Comparisons</h1><span>Paired evidence, diagnosis and controlled next steps</span></div>',
        unsafe_allow_html=True,
    )
    if can_write and len(runs) >= 2:
        with st.expander("Compare two terminal runs", expanded=not comparisons):
            with st.form("compare"):
                baseline = st.selectbox(
                    "Baseline", runs, format_func=lambda run: run.get("id")
                )
                candidate = st.selectbox(
                    "Candidate",
                    runs,
                    index=min(1, len(runs) - 1),
                    format_func=lambda run: run.get("id"),
                )
                objective = st.selectbox(
                    "Objective",
                    [
                        "Diagnosis only",
                        "QUALITY_FIRST",
                        "LATENCY_FIRST",
                        "COST_FIRST",
                        "BALANCED",
                        "CUSTOM",
                    ],
                )
                metric_key = st.text_input(
                    "Quality measure", "DENSE_RETRIEVAL:recall@5"
                )
                minimum = st.number_input(
                    "Minimum quality", min_value=0.0, max_value=1.0, value=0.9
                )
                if st.form_submit_button("Create comparison", type="primary"):
                    specification = (
                        None
                        if objective == "Diagnosis only"
                        else {
                            "kind": objective,
                            "measures": [
                                {
                                    "key": metric_key,
                                    "direction": "maximize",
                                    "minimum": minimum,
                                }
                            ],
                            "priorities": [metric_key]
                            if objective != "BALANCED"
                            else [],
                        }
                    )
                    api(
                        "POST",
                        "/comparisons",
                        json={
                            "baseline_run_id": baseline["id"],
                            "candidate_run_id": candidate["id"],
                            "objective": specification,
                        },
                    )
                    st.rerun()
    if not comparisons:
        st.info("Create a comparison after at least two runs complete.")
        return
    for comparison in reversed(comparisons):
        detected = [
            diagnosis
            for diagnosis in comparison.get("diagnoses", [])
            if diagnosis.get("status") == "DETECTED"
        ]
        with st.expander(
            f"{comparison.get('baseline_run_id')}  →  {comparison.get('candidate_run_id')}",
            expanded=True,
        ):
            st.markdown(
                f'<div class="alert-strip">Change isolation: <b>{esc(comparison.get("change_isolation", "UNKNOWN"))}</b> &nbsp;·&nbsp; {len(comparison.get("metric_deltas", []))} paired metric deltas &nbsp;·&nbsp; {len(comparison.get("changed_cases", []))} changed cases</div>',
                unsafe_allow_html=True,
            )
            columns = st.columns(3)
            with columns[0]:
                card(
                    "Baseline",
                    comparison.get("baseline_run_id", "—"),
                    "effective configuration",
                )
            with columns[1]:
                card(
                    "Candidate",
                    comparison.get("candidate_run_id", "—"),
                    "effective configuration",
                )
            with columns[2]:
                card(
                    "Diagnosis",
                    detected[0].get("confidence", "None") if detected else "No signal",
                    detected[0].get("rule_id", "insufficient evidence")
                    if detected
                    else "deterministic rules",
                )
            st.markdown(
                '<div class="section-head"><h2>Configuration changes</h2></div>',
                unsafe_allow_html=True,
            )
            st.dataframe(
                [
                    {
                        "Group": item.get("group"),
                        "Path": item.get("path"),
                        "Before": item.get("before"),
                        "After": item.get("after"),
                    }
                    for item in comparison.get("configuration_diff", [])
                ],
                use_container_width=True,
                hide_index=True,
            )
            st.markdown(
                '<div class="section-head"><h2>Stage metric deltas</h2><span>paired populations and confidence intervals</span></div>',
                unsafe_allow_html=True,
            )
            st.dataframe(
                [
                    {
                        "Stage": item.get("stage"),
                        "Metric": item.get("name"),
                        "Baseline": score(item.get("baseline_mean")),
                        "Candidate": score(item.get("candidate_mean")),
                        "Delta": delta(item.get("delta")),
                        "Paired": len(item.get("paired_case_ids", [])),
                        "CI": str(item.get("ci")),
                    }
                    for item in comparison.get("metric_deltas", [])
                ],
                use_container_width=True,
                hide_index=True,
            )
            if detected:
                diagnosis = detected[0]
                limitations = diagnosis.get("limitations") or [
                    "Diagnostic association, not causal proof"
                ]
                st.markdown(
                    f'<div class="card"><div class="eyebrow">Regression detected · {esc(diagnosis.get("confidence"))} confidence</div><h2 style="margin:.35rem 0">{esc(diagnosis.get("rule_id"))}</h2><div class="muted">Affected stage: {esc(", ".join(diagnosis.get("stages", [])) or "earliest observed stage")}</div><p>{esc(limitations[0])}</p></div>',
                    unsafe_allow_html=True,
                )
            st.markdown(
                '<div class="section-head"><h2>Recommendations</h2><span>review before creating a new experiment</span></div>',
                unsafe_allow_html=True,
            )
            for recommendation in comparison.get("recommendations", []):
                st.markdown(
                    f'<div class="card"><div class="card-title">{esc(recommendation.get("objective", "Controlled next experiment"))}</div><div>{esc(recommendation.get("explanation", "Evidence-backed recommendation"))}</div><div class="muted" style="margin-top:.5rem">Confidence: {esc(recommendation.get("confidence", "—"))}</div></div>',
                    unsafe_allow_html=True,
                )
                if can_write and recommendation.get("kind") == "CONTROLLED_EXPERIMENT":
                    if st.button(
                        "Preview suggested experiment",
                        key="preview-" + recommendation["id"],
                    ):
                        st.session_state["draft-" + recommendation["id"]] = api(
                            "POST",
                            f"/comparisons/{comparison['id']}/recommendations/{recommendation['id']}/preview",
                        ).json()
                    draft = st.session_state.get("draft-" + recommendation["id"])
                    if draft:
                        st.json(draft)
                        if st.button(
                            "Confirm creation (does not run)",
                            key="create-" + recommendation["id"],
                        ):
                            api(
                                "POST",
                                f"/comparisons/{comparison['id']}/recommendations/{recommendation['id']}/create",
                            )
                            st.success("Experiment created; no run started")
            if comparison.get("changed_cases"):
                with st.expander("Changed cases and evidence"):
                    st.json(comparison["changed_cases"])
            st.download_button(
                "Download JSON",
                json.dumps(comparison, indent=2),
                file_name="comparison.json",
                key="json-" + comparison["id"],
            )


def administration_page():
    st.markdown(
        '<div class="section-head"><h1>Administration</h1><span>Database-managed capabilities and audit trail</span></div>',
        unsafe_allow_html=True,
    )
    scope = st.selectbox("Configuration scope", ["platform", "workspace:default"])
    config = api("GET", "/configuration/" + scope).json()
    definitions = api("GET", "/configuration/definitions").json()
    groups = {}
    for definition in definitions:
        groups.setdefault(definition.get("category", "Capabilities"), []).append(
            definition
        )
    with st.form("configuration"):
        values = {}
        for category, definitions_for_category in groups.items():
            st.markdown(f"**{category}**")
            for definition in definitions_for_category:
                key = definition["key"]
                current = config["values"].get(key, definition.get("default"))
                if definition.get("kind") == "bool":
                    values[key] = st.checkbox(
                        key, value=current, help=definition.get("description")
                    )
                elif definition.get("kind") == "int":
                    values[key] = st.number_input(
                        key,
                        min_value=definition.get("minimum"),
                        max_value=definition.get("maximum"),
                        value=current,
                    )
                else:
                    text = st.text_area(key, json.dumps(current, indent=2))
                    try:
                        values[key] = json.loads(text)
                    except ValueError:
                        st.warning("Invalid JSON for " + key)
                st.caption(definition.get("runtime", "NEXT_RUN"))
        reason = st.text_input("Reason for change")
        if st.form_submit_button("Save new configuration version", type="primary"):
            api(
                "PUT",
                "/configuration/" + scope,
                json={
                    "values": values,
                    "expected_revision": config["revision"],
                    "reason": reason,
                },
            )
            st.rerun()
    with st.expander("Audit history"):
        st.dataframe(
            api("GET", "/audit").json(), use_container_width=True, hide_index=True
        )
    with st.expander("Register provider/model"):
        with st.form("model-registration"):
            provider = st.text_input("Provider identity")
            model = st.text_input("Model name")
            revision = st.text_input("Model revision")
            endpoint = st.text_input("Compatible API base URL")
            credential_ref = st.text_input("Credential environment variable name")
            roles = st.multiselect("Supported roles", ["GENERATOR", "JUDGE", "ANALYST"])
            if st.form_submit_button("Register model"):
                api(
                    "POST",
                    "/models",
                    json={
                        "provider": provider,
                        "model": model,
                        "model_revision": revision or None,
                        "roles": roles,
                        "endpoint_type": "compatible",
                        "endpoint": endpoint or None,
                        "credential_ref": credential_ref or None,
                    },
                )
                st.success("Model registered")
        st.dataframe(
            api("GET", "/models").json(), use_container_width=True, hide_index=True
        )


inject_css()
if "token" not in st.session_state:
    login()
    st.stop()

user = api("GET", "/me").json()
page, can_write = sidebar(user)

if page == "Dashboard":
    dashboard(user)
elif page == "Datasets":
    datasets_page(can_write)
elif page == "Experiments":
    experiments_page(can_write)
elif page == "Runs":
    runs_page()
elif page == "Comparisons":
    comparisons_page(can_write)
elif page == "Administration":
    administration_page()
