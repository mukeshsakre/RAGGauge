import csv
import io

from jinja2 import BaseLoader, Environment, select_autoescape

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8"><title>RAGGauge comparison</title>
<style>body{font:16px system-ui;margin:3rem;max-width:1100px;color:#142b36}table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{padding:.6rem;border-bottom:1px solid #ddd;text-align:left}code{background:#eef4f6}article{border-left:4px solid #16798a;padding:1rem;margin:1rem 0}.muted{color:#526770}</style></head><body>
<h1>RAGGauge comparison</h1><p>{{ c.baseline_run_id }} → {{ c.candidate_run_id }}</p>
<p>Dataset: {{c.dataset_version}} · {{c.change_isolation}}</p>
{% for notice in c.compatibility %}<p>{{notice}}</p>{% endfor %}
<h2>Configuration changes</h2><table><tr><th>Group</th><th>Setting</th><th>Baseline</th><th>Candidate</th></tr>{% for d in c.configuration_diff %}<tr><td>{{d.domain}} / {{d.group}}</td><td>{{d.path}}</td><td>{{d.before}}</td><td>{{d.after}}</td></tr>{% endfor %}</table>
<h2>Paired metrics</h2><table><tr><th>Stage / Metric</th><th>Baseline</th><th>Candidate</th><th>Delta</th><th>Paired cases</th></tr>{% for d in c.metric_deltas %}<tr><td>{{d.stage}} / {{d.name}}</td><td>{{d.baseline_mean}}</td><td>{{d.candidate_mean}}</td><td>{{d.delta}}</td><td>{{d.paired_case_ids|length}}</td></tr>{% endfor %}</table>
<h2>Diagnosis</h2>{% for d in c.diagnoses %}{% if d.status == 'DETECTED' %}<article><h3>{{d.rule_id}}</h3><p>{{d.stages}} · Confidence: {{d.confidence}}</p><p>{{d.factors}}</p><p class="muted">{{d.limitations}}</p><details><summary>Evidence</summary><pre>{{d.evidence_refs|tojson(indent=2)}}</pre></details></article>{% endif %}{% endfor %}
<h2>Recommendations</h2>{% for r in c.recommendations %}<article><h3>{{r.objective}}</h3><p>{{r.explanation}}</p><p>Proposed overrides: {{r.overrides}}</p><p>Preferred evaluated run: {{r.recommended_run_id or 'No unique supported preference'}}</p><p>Alternatives: {{r.alternatives}}</p><p>{{r.uncertainty}}</p></article>{% endfor %}
<h2>Measurement coverage and provenance</h2><details><summary>Complete structured comparison</summary><pre>{{c|tojson(indent=2)}}</pre></details><p>No experiment was executed by this report.</p></body></html>"""


def comparison_html(comparison):
    env = Environment(loader=BaseLoader(), autoescape=select_autoescape(default=True))
    return env.from_string(TEMPLATE).render(c=comparison.model_dump(mode="json"))


def comparison_csv(comparison):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "stage",
            "metric",
            "baseline_mean",
            "candidate_mean",
            "paired_delta",
            "paired_count",
            "baseline_success",
            "candidate_success",
        ]
    )
    for d in comparison.metric_deltas:
        writer.writerow(
            [
                d.stage,
                d.name,
                d.baseline_mean,
                d.candidate_mean,
                d.delta,
                len(d.paired_case_ids),
                d.baseline_coverage.get("SUCCESS", 0),
                d.candidate_coverage.get("SUCCESS", 0),
            ]
        )
    return output.getvalue()
