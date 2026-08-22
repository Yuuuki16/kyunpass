"""Retrieve semantically similar reference patterns from Supabase (pgvector).

The Supabase table ``rag_patterns`` holds hand-labeled example conversations,
each scored 0-5 on six axes (columns ``a``-``f``, in the same order as
``VARIABLE_LABELS`` in ``app.main``) together with an OpenAI embedding of the
example. Given the OTHER speaker's messages from the current conversation,
this module embeds that text and calls the ``match_rag_patterns`` Postgres
function (pgvector cosine search) to find the most similar labeled examples,
so the LLM prompt can be grounded with concrete, scored reference cases.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

# rag_patterns scores each variable 0-5; the rest of kyunpass scores 0-100.
VARIABLE_COLUMN_SCALE = 20
VARIABLE_COLUMNS = ("a", "b", "c", "d", "e", "f")
VARIABLE_KEYS = (
    "respect",
    "interest",
    "relationship_building",
    "casual_sex_seeking",
    "self_priority",
    "relationship_ambiguity",
)


def _supabase_credentials() -> tuple[str, str] | None:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return url, key


def _embed_query(text: str) -> list[float]:
    from openai import OpenAI

    response = OpenAI().embeddings.create(model=EMBEDDING_MODEL, input=[text])
    return response.data[0].embedding


def _row_to_pattern(row: dict[str, object]) -> dict[str, object]:
    variables = {
        key: max(0, min(100, int(row[column]) * VARIABLE_COLUMN_SCALE))
        for key, column in zip(VARIABLE_KEYS, VARIABLE_COLUMNS)
        if row.get(column) is not None
    }
    return {
        "id": row.get("id"),
        "pattern_name": row.get("pattern_name"),
        "conversation_example": row.get("conversation_example"),
        "description": row.get("description"),
        "variables": variables,
    }


def find_similar_rag_patterns(query_text: str, *, top_k: int = 3) -> list[dict[str, object]]:
    """Return the rag_patterns rows most similar to ``query_text``.

    This is purely optional grounding: whenever Supabase or the embedding call
    is unavailable (missing credentials, blank query, API/RPC failure) it
    falls back to an empty list rather than raising, mirroring how
    ``infer_with_llm`` degrades.
    """
    if not query_text.strip():
        return []
    credentials = _supabase_credentials()
    if credentials is None:
        return []

    try:
        from supabase import create_client

        query_embedding = _embed_query(query_text)
        client = create_client(*credentials)
        result = client.rpc(
            "match_rag_patterns",
            {"query_embedding": query_embedding, "match_count": top_k},
        ).execute()
    except Exception:
        logger.exception("Supabase pattern retrieval failed; skipping retrieval.")
        return []

    return [_row_to_pattern(row) for row in (result.data or [])]
