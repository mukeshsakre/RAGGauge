import pytest

from src.contracts import *
from src.pipeline import *


def test_source_preserving_chunks_and_rechunk_identity():
    corpus = CorpusVersion(
        name="text", documents=[Document(id="d", text="abcdef ghijkl mnopqr")]
    )
    a, aa = chunk_documents(corpus, ChunkingConfig(strategy="fixed", size=6, overlap=0))
    b, bb = chunk_documents(
        corpus, ChunkingConfig(strategy="sliding", size=8, overlap=2)
    )
    assert aa.fingerprint != bb.fingerprint
    assert not {c.id for c in a} & {c.id for c in b}
    for c in a + b:
        span = c.spans[0]
        assert c.text == corpus.documents[0].text[span.start : span.end]


def test_rrf_stable_ties_original_evidence_unmodified():
    a = Candidate(id="a", document_id="a", rank=1, score=9)
    b = Candidate(id="b", document_id="b", rank=1, score=88)
    fused = reciprocal_rank_fusion([[a], [b]], 60, 2)
    assert [c.id for c in fused] == ["a", "b"]
    assert fused[0].score == pytest.approx(1 / 61)
    assert a.score == 9 and b.score == 88


def test_bm25_lab_exact_context_and_latency():
    pytest.importorskip("bm25s")
    corpus = CorpusVersion(
        name="test",
        documents=[
            Document(id="d", text="The leave entitlement is fourteen days."),
            Document(id="other", text="Office parking is free."),
        ],
    )
    case = EvaluationCase(
        id="q",
        question="leave entitlement",
        evidence=[
            EvidenceUnit(
                id="gold",
                spans=[
                    SourceSpan(
                        corpus_version=corpus.id, document_id="d", start=0, end=38
                    )
                ],
            )
        ],
    )
    lab = PipelineLab(
        corpus,
        {
            "retrieval": {"strategy": "lexical"},
            "chunking": {"size": 100, "overlap": 0},
            "context": {"max_characters": 10},
        },
        None,
    )
    trace = lab.execute(case, "execution")
    assert not trace.stage_errors
    assert trace.stages[Stage.LEXICAL_RETRIEVAL].candidates[0].document_id == "d"
    assert trace.stages[Stage.GENERATOR_CONTEXT].context == ["The leave "]
    assert trace.stages[Stage.GENERATOR_CONTEXT].truncated
    assert trace.total_latency.value > 0
    assert trace.generated_answer is None


def test_cyclic_trace_rejected():
    a = StageObservation(
        stage=Stage.DENSE_RETRIEVAL,
        inputs=[Stage.FUSED_RETRIEVAL],
        implementation="x",
        configuration_fingerprint="x",
    )
    b = StageObservation(
        stage=Stage.FUSED_RETRIEVAL,
        inputs=[Stage.DENSE_RETRIEVAL],
        implementation="x",
        configuration_fingerprint="x",
    )
    with pytest.raises(ValueError):
        NormalizedTrace(
            case_execution_id="x", question="q", stages={a.stage: a, b.stage: b}
        )
