"""Apply captured observability policy only after evaluating available evidence."""


def retain_case(case, policy):
    if not case.trace:
        return case
    trace = case.trace.model_copy(deep=True)
    if not policy.values["observability.cost_tracking"]:
        trace.costs = {}
        for call in trace.invocations:
            call.cost = None
    if not policy.values["observability.token_tracking"]:
        for call in trace.invocations:
            call.input_tokens = None
            call.output_tokens = None
    if not policy.values["observability.trace_capture"]:
        trace.generated_answer = None
        trace.metadata = {"payload_retention": "DISABLED"}
        for obs in trace.stages.values():
            obs.context = None
            obs.candidates = None
            obs.spans = []
            obs.evidence_ids = None
            obs.evidence_complete = False
    return case.model_copy(update={"trace": trace})
