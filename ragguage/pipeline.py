"""Instrumented local pipeline: source-preserving chunks, BM25, pgvector, RRF."""

from __future__ import annotations

import json
import os
import re
from time import perf_counter
from typing import Literal

import httpx
import numpy as np
from pydantic import Field, model_validator
from sqlalchemy import text

from .contracts import *
from .metrics import covered_evidence


class ChunkingConfig(Contract):
    enabled: bool = True
    strategy: Literal["fixed", "sliding", "recursive", "semantic"] = "recursive"
    size: int = Field(default=500, ge=1, le=100000)
    overlap: int = Field(default=50, ge=0)
    semantic_threshold: float = Field(default=0.5, ge=-1, le=1)

    @model_validator(mode="after")
    def valid(self):
        if self.overlap >= self.size:
            raise ValueError("Chunk overlap must be less than size")
        return self


class EmbeddingConfig(Contract):
    provider: Literal["sentence-transformers"] = "sentence-transformers"
    model: str = "sentence-transformers/all-MiniLM-L6-v2"
    revision: str | None = None
    normalize: bool = True


class BranchConfig(Contract):
    top_k: int = Field(default=50, ge=1, le=10000)


class LexicalConfig(BranchConfig):
    algorithm: Literal["bm25"] = "bm25"
    k1: float = Field(default=1.5, gt=0)
    b: float = Field(default=0.75, ge=0, le=1)


class FusionConfig(Contract):
    algorithm: Literal["rrf"] = "rrf"
    rrf_k: int = Field(default=60, ge=1)


class RetrievalConfig(Contract):
    strategy: Literal["dense", "lexical", "hybrid"] = "dense"
    dense: BranchConfig = Field(default_factory=BranchConfig)
    lexical: LexicalConfig = Field(default_factory=LexicalConfig)
    fusion: FusionConfig = Field(default_factory=FusionConfig)
    final_top_k: int = Field(default=20, ge=1, le=10000)


class RerankingConfig(Contract):
    enabled: bool = False
    model: str = "cross-encoder/ms-marco-MiniLM-L6-v2"
    revision: str | None = None
    top_k: int = Field(default=10, ge=1, le=10000)


class ContextConfig(Contract):
    max_characters: int = Field(default=12000, ge=1)


class GenerationConfig(Contract):
    enabled: bool = False
    model_registration: str | None = None
    temperature: float = Field(default=0, ge=0, le=2)
    max_tokens: int = Field(default=512, ge=1)
    seed: int | None = None


class JudgeConfig(Contract):
    model_registration: str | None = None
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)


class PromptConfig(Contract):
    version: str = "default-rag-v1"
    system: str = (
        "Answer using only the supplied context. If the answer is unsupported, say so."
    )


class EvaluationConfig(Contract):
    metrics: list[str] = Field(
        default_factory=lambda: [
            "precision@5",
            "recall@5",
            "ndcg@5",
            "precision@10",
            "recall@10",
            "ndcg@10",
        ]
    )
    quality_gates: dict[str, float] = Field(default_factory=dict)

    @model_validator(mode="after")
    def valid_metrics(self):
        if len(set(self.metrics)) != len(self.metrics):
            raise ValueError("Duplicate requested metrics")
        for metric in self.metrics:
            if metric in {
                "faithfulness",
                "factual_correctness",
                "answer_relevance",
                "context_precision",
                "context_recall",
            }:
                continue
            match = re.fullmatch(r"(precision|recall|ndcg)@([1-9][0-9]*)", metric)
            if not match:
                raise ValueError("Unknown metric name or cutoff")
        if any(not 0 <= v <= 1 for v in self.quality_gates.values()):
            raise ValueError("Quality gates must be between zero and one")
        return self


def chunk_documents(corpus: CorpusVersion, config: ChunkingConfig, encoder=None):
    chunks = []
    artifact = Artifact(
        kind="CHUNK_SET",
        parent_fingerprints=[fingerprint(corpus)],
        configuration={
            "implementation": "source-chunker-v1",
            "preprocessing": corpus.preprocessing_version,
            **config.model_dump(),
        },
    )
    for doc in corpus.documents:
        boundaries = []
        if not config.enabled:
            boundaries = [(0, len(doc.text))] if doc.text else []
        elif config.strategy == "semantic":
            if encoder is None:
                raise ValueError("Semantic chunking requires an embedding provider")
            sentences = [
                m.span()
                for m in re.finditer(r"[^.!?]+[.!?]*", doc.text)
                if m.group().strip()
            ]
            if sentences:
                vectors = np.asarray(encoder([doc.text[a:b] for a, b in sentences]))
                start = sentences[0][0]
                for i in range(1, len(sentences)):
                    similarity = float(
                        np.dot(vectors[i - 1], vectors[i])
                        / (
                            np.linalg.norm(vectors[i - 1]) * np.linalg.norm(vectors[i])
                            + 1e-12
                        )
                    )
                    if (
                        similarity < config.semantic_threshold
                        or sentences[i][1] - start > config.size
                    ):
                        boundaries.append((start, sentences[i - 1][1]))
                        start = sentences[i][0]
                boundaries.append((start, sentences[-1][1]))
        else:
            start = 0
            while start < len(doc.text):
                end = min(start + config.size, len(doc.text))
                if config.strategy == "recursive" and end < len(doc.text):
                    break_at = doc.text.rfind("\n", start + config.size // 2, end)
                    if break_at < 0:
                        break_at = doc.text.rfind(" ", start + config.size // 2, end)
                    if break_at > start:
                        end = break_at + 1
                boundaries.append((start, end))
                if end == len(doc.text):
                    break
                overlap = (
                    config.overlap if config.strategy in {"sliding", "recursive"} else 0
                )
                start = max(start + 1, end - overlap)
        for start, end in boundaries:
            if end <= start:
                continue
            cid = fingerprint(
                {
                    "artifact": artifact.fingerprint,
                    "document": doc.id,
                    "start": start,
                    "end": end,
                }
            )
            chunks.append(
                Candidate(
                    id=cid,
                    chunk_id=cid,
                    document_id=doc.id,
                    rank=len(chunks) + 1,
                    text=doc.text[start:end],
                    chunk_artifact=artifact.fingerprint,
                    spans=[
                        SourceSpan(
                            corpus_version=corpus.id,
                            document_id=doc.id,
                            start=start,
                            end=end,
                        )
                    ],
                )
            )
    artifact.status = "COMPLETED"
    artifact.checksum = fingerprint([c.model_dump(mode="json") for c in chunks])
    return chunks, artifact


def reciprocal_rank_fusion(branches, k=60, final_k=20):
    scores, candidates = {}, {}
    for branch in branches:
        for c in branch:
            scores[c.id] = scores.get(c.id, 0) + 1 / (k + c.rank)
            candidates.setdefault(c.id, c)
    ids = sorted(scores, key=lambda cid: (-scores[cid], cid))[:final_k]
    return [
        candidates[cid].model_copy(update={"rank": rank + 1, "score": scores[cid]})
        for rank, cid in enumerate(ids)
    ]


class LocalEncoder:
    def __init__(self, config):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(
            config.model, revision=config.revision, trust_remote_code=False
        )
        self.config = config

    def __call__(self, texts):
        return self.model.encode(
            texts, normalize_embeddings=self.config.normalize, show_progress_bar=False
        )


class BM25Index:
    def __init__(self, chunks, config):
        import bm25s

        self.module = bm25s
        self.chunks = chunks
        self.index = bm25s.BM25(k1=config.k1, b=config.b)
        self.index.index(
            bm25s.tokenize([c.text for c in chunks], show_progress=False),
            show_progress=False,
        )

    def search(self, query, k):
        ids, scores = self.index.retrieve(
            self.module.tokenize([query], show_progress=False),
            k=min(k, len(self.chunks)),
            show_progress=False,
        )
        return [
            self.chunks[int(i)].model_copy(
                update={"rank": rank + 1, "score": float(score)}
            )
            for rank, (i, score) in enumerate(zip(ids[0], scores[0]))
        ]


class PgVectorIndex:
    def __init__(self, engine, chunks, vectors, artifact):
        self.engine = engine
        self.chunks = {c.id: c for c in chunks}
        self.artifact = artifact
        with engine.begin() as c:
            c.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            c.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS retrieval_vectors (artifact text NOT NULL, chunk_id text NOT NULL, embedding vector NOT NULL, PRIMARY KEY (artifact,chunk_id))"
                )
            )
            # Atomic replacement for this specification; persisted artifact checksums validate reuse.
            for chunk, vector in zip(chunks, vectors):
                c.execute(
                    text(
                        "INSERT INTO retrieval_vectors (artifact,chunk_id,embedding) VALUES (:a,:c,CAST(:v AS vector)) ON CONFLICT (artifact,chunk_id) DO NOTHING"
                    ),
                    {
                        "a": artifact,
                        "c": chunk.id,
                        "v": json.dumps([float(v) for v in vector]),
                    },
                )

    def search(self, vector, k):
        with self.engine.connect() as c:
            rows = c.execute(
                text(
                    "SELECT chunk_id, 1-(embedding <=> CAST(:v AS vector)) AS score FROM retrieval_vectors WHERE artifact=:a ORDER BY embedding <=> CAST(:v AS vector),chunk_id LIMIT :k"
                ),
                {
                    "a": self.artifact,
                    "v": json.dumps([float(v) for v in vector]),
                    "k": k,
                },
            ).all()
        return [
            self.chunks[r[0]].model_copy(update={"rank": i + 1, "score": float(r[1])})
            for i, r in enumerate(rows)
        ]


class PipelineLab:
    def __init__(
        self, corpus, configuration, engine, model_resolver=None, encoder=None
    ):
        self.configuration = configuration
        self.retrieval = RetrievalConfig.model_validate(
            configuration.get("retrieval", {})
        )
        self.chunking = ChunkingConfig.model_validate(configuration.get("chunking", {}))
        self.embedding = EmbeddingConfig.model_validate(
            configuration.get("embedding", {})
        )
        self.reranking = RerankingConfig.model_validate(
            configuration.get("reranking", {})
        )
        self.context = ContextConfig.model_validate(configuration.get("context", {}))
        self.generation = GenerationConfig.model_validate(
            configuration.get("generation", {})
        )
        self.resolver = model_resolver
        need_encoder = (
            self.retrieval.strategy in {"dense", "hybrid"}
            or self.chunking.strategy == "semantic"
        )
        self.encoder = encoder or (
            LocalEncoder(self.embedding) if need_encoder else None
        )
        self.chunks, chunk_artifact = chunk_documents(
            corpus, self.chunking, self.encoder
        )
        if not self.chunks:
            raise ValueError("Corpus produced no chunks")
        self.artifacts = [chunk_artifact]
        self.dense = None
        self.lexical = None
        self.reranker = None
        if self.retrieval.strategy in {"dense", "hybrid"}:
            vectors = self.encoder([c.text for c in self.chunks])
            embedding_artifact = Artifact(
                kind="EMBEDDING",
                parent_fingerprints=[chunk_artifact.fingerprint],
                configuration=self.embedding.model_dump(),
                status="COMPLETED",
                checksum=fingerprint(np.asarray(vectors).tolist()),
            )
            index_artifact = Artifact(
                kind="DENSE_INDEX",
                parent_fingerprints=[
                    embedding_artifact.fingerprint,
                    embedding_artifact.checksum,
                ],
                configuration={
                    "backend": "pgvector",
                    "distance": "cosine",
                    "search": "exact",
                },
                status="COMPLETED",
                checksum=embedding_artifact.checksum,
            )
            self.artifacts.extend([embedding_artifact, index_artifact])
            self.dense = PgVectorIndex(
                engine, self.chunks, vectors, index_artifact.fingerprint
            )
        if self.retrieval.strategy in {"lexical", "hybrid"}:
            self.lexical = BM25Index(self.chunks, self.retrieval.lexical)
            self.artifacts.append(
                Artifact(
                    kind="LEXICAL_INDEX",
                    parent_fingerprints=[chunk_artifact.fingerprint],
                    configuration={
                        "backend": "bm25s",
                        "k1": self.retrieval.lexical.k1,
                        "b": self.retrieval.lexical.b,
                    },
                    status="COMPLETED",
                    checksum=chunk_artifact.checksum,
                )
            )
        if self.reranking.enabled:
            from sentence_transformers import CrossEncoder

            self.reranker = CrossEncoder(
                self.reranking.model,
                revision=self.reranking.revision,
                trust_remote_code=False,
            )

    def execute(self, case, execution_id):
        start = perf_counter()
        trace = NormalizedTrace(case_execution_id=execution_id, question=case.question)
        branches = []

        def stage(stage_id, inputs, fn):
            begin = perf_counter()
            candidates = fn()
            spans = [s for c in candidates for s in c.spans]
            obs = StageObservation(
                stage=stage_id,
                inputs=inputs,
                implementation="pipeline-lab-v1",
                configuration_fingerprint=fingerprint(self.configuration),
                candidates=candidates,
                spans=spans,
                evidence_ids=covered_evidence(case, spans) if case.evidence else None,
                evidence_complete=bool(case.evidence),
                latency=Measurement(
                    value=(perf_counter() - begin) * 1000,
                    boundary=stage_id,
                    provenance="perf_counter",
                ),
            )
            trace.stages[stage_id] = obs
            return candidates

        try:
            if self.dense:
                candidates = stage(
                    Stage.DENSE_RETRIEVAL,
                    [],
                    lambda: self.dense.search(
                        self.encoder([case.question])[0], self.retrieval.dense.top_k
                    ),
                )
                branches.append(candidates)
            if self.lexical:
                candidates = stage(
                    Stage.LEXICAL_RETRIEVAL,
                    [],
                    lambda: self.lexical.search(
                        case.question, self.retrieval.lexical.top_k
                    ),
                )
                branches.append(candidates)
            previous = Stage.DENSE_RETRIEVAL if self.dense else Stage.LEXICAL_RETRIEVAL
            if len(branches) == 2:
                candidates = stage(
                    Stage.FUSED_RETRIEVAL,
                    [Stage.DENSE_RETRIEVAL, Stage.LEXICAL_RETRIEVAL],
                    lambda: reciprocal_rank_fusion(
                        branches,
                        self.retrieval.fusion.rrf_k,
                        self.retrieval.final_top_k,
                    ),
                )
                previous = Stage.FUSED_RETRIEVAL
            else:
                candidates = candidates[: self.retrieval.final_top_k]
        except Exception:
            trace.stage_errors.append(
                Failure(
                    code="RETRIEVAL_FAILED",
                    stage="retrieval",
                    message="Retrieval execution failed; provider details withheld",
                )
            )
            trace.total_latency = Measurement(
                value=(perf_counter() - start) * 1000,
                boundary="application",
                provenance="perf_counter",
            )
            return trace
        if self.reranker:
            try:

                def rerank():
                    scores = self.reranker.predict(
                        [(case.question, c.text) for c in candidates]
                    )
                    ordered = sorted(
                        zip(candidates, scores),
                        key=lambda pair: (-float(pair[1]), pair[0].id),
                    )[: self.reranking.top_k]
                    return [
                        c.model_copy(update={"rank": i + 1, "score": float(score)})
                        for i, (c, score) in enumerate(ordered)
                    ]

                candidates = stage(Stage.RERANKED_RETRIEVAL, [previous], rerank)
                previous = Stage.RERANKED_RETRIEVAL
            except Exception:
                trace.stage_errors.append(
                    Failure(
                        code="RERANK_FAILED",
                        stage="reranking",
                        message="Reranking failed; no fallback was applied",
                    )
                )
                return trace
        begin = perf_counter()
        remaining = self.context.max_characters
        contexts = []
        spans = []
        for c in candidates:
            content = (c.text or "")[:remaining]
            if content:
                contexts.append(content)
                for span in c.spans:
                    spans.append(
                        span.model_copy(
                            update={"end": min(span.end, span.start + len(content))}
                        )
                    )
                remaining -= len(content)
            if remaining <= 0:
                break
        trace.stages[Stage.GENERATOR_CONTEXT] = StageObservation(
            stage=Stage.GENERATOR_CONTEXT,
            inputs=[previous],
            implementation="character-budget-v1",
            configuration_fingerprint=fingerprint(self.context),
            context=contexts,
            spans=spans,
            evidence_ids=covered_evidence(case, spans) if case.evidence else None,
            evidence_complete=bool(case.evidence),
            truncated=sum(len(c.text or "") for c in candidates)
            > self.context.max_characters,
            latency=Measurement(
                value=(perf_counter() - begin) * 1000,
                boundary="context_assembly",
                provenance="perf_counter",
            ),
        )
        if self.generation.enabled:
            try:
                registration = self.resolver(self.generation.model_registration)
                answer, invocation = generate(
                    registration,
                    case.question,
                    contexts,
                    self.generation,
                    self.configuration.get("prompt", {}),
                )
                trace.generated_answer = answer
                trace.invocations.append(invocation)
                trace.stages[Stage.GENERATION] = StageObservation(
                    stage=Stage.GENERATION,
                    inputs=[Stage.GENERATOR_CONTEXT],
                    implementation=registration.provider,
                    configuration_fingerprint=fingerprint(self.generation),
                    latency=Measurement(
                        value=invocation.latency_ms,
                        boundary="generation",
                        provenance="perf_counter",
                    ),
                )
            except Exception:
                trace.stage_errors.append(
                    Failure(
                        code="GENERATION_FAILED",
                        stage="generation",
                        message="Generation failed; provider details withheld",
                    )
                )
        trace.total_latency = Measurement(
            value=(perf_counter() - start) * 1000,
            boundary="application",
            provenance="perf_counter",
        )
        return trace


def generate(registration, question, contexts, settings, prompt):
    if not registration.enabled or ModelRole.GENERATOR not in registration.roles:
        raise ValueError("Registration is not an enabled generator")
    if not registration.endpoint:
        raise ValueError("Generator endpoint is required")
    key = (
        os.environ.get(registration.credential_ref)
        if registration.credential_ref
        else None
    )
    if registration.credential_ref and not key:
        raise ValueError("Credential reference unavailable")
    messages = [
        {
            "role": "system",
            "content": prompt.get(
                "system",
                "Answer using only the supplied context. If the answer is unsupported, say so.",
            ),
        },
        {
            "role": "user",
            "content": "Context:\n"
            + "\n\n".join(contexts)
            + "\n\nQuestion: "
            + question,
        },
    ]
    payload = {
        "model": registration.model,
        "messages": messages,
        "temperature": settings.temperature,
        "max_tokens": settings.max_tokens,
    }
    if settings.seed is not None:
        payload["seed"] = settings.seed
    begin = perf_counter()
    with httpx.Client(timeout=60, follow_redirects=False) as client:
        response = client.post(
            registration.endpoint.rstrip("/") + "/chat/completions",
            json=payload,
            headers={"Authorization": "Bearer " + key} if key else {},
        )
        response.raise_for_status()
        data = response.json()
    usage = data.get("usage", {})
    invocation = Invocation(
        role=ModelRole.GENERATOR,
        model_registration=registration.id,
        registration_revision=registration.revision,
        normalized_identity=f"{registration.provider}:{registration.model}:{registration.model_revision or 'unknown'}",
        category=CostCategory.APPLICATION,
        purpose="generation",
        latency_ms=(perf_counter() - begin) * 1000,
        input_tokens=usage.get("prompt_tokens"),
        output_tokens=usage.get("completion_tokens"),
    )
    return data["choices"][0]["message"]["content"], invocation
