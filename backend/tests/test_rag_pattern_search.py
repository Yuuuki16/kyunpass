from app.rag_pattern_search import find_similar_rag_patterns


class _FakeEmbeddingItem:
    def __init__(self, embedding: list[float]) -> None:
        self.embedding = embedding


class _FakeEmbeddingResponse:
    def __init__(self, embedding: list[float]) -> None:
        self.data = [_FakeEmbeddingItem(embedding)]


class _FakeEmbeddings:
    def create(self, *, model: str, input: list[str]) -> _FakeEmbeddingResponse:
        return _FakeEmbeddingResponse([0.1, 0.2, 0.3])


class _FakeOpenAI:
    def __init__(self) -> None:
        self.embeddings = _FakeEmbeddings()


class _FakeRpcResult:
    def __init__(self, data: list[dict[str, object]]) -> None:
        self.data = data


class _FakeRpcBuilder:
    def __init__(self, data: list[dict[str, object]], captured: dict) -> None:
        self._data = data
        self._captured = captured

    def execute(self) -> _FakeRpcResult:
        return _FakeRpcResult(self._data)


class _FakeSupabaseClient:
    def __init__(self, data: list[dict[str, object]], captured: dict) -> None:
        self._data = data
        self._captured = captured

    def rpc(self, name: str, params: dict[str, object]) -> _FakeRpcBuilder:
        self._captured["name"] = name
        self._captured["params"] = params
        return _FakeRpcBuilder(self._data, self._captured)


def _set_supabase_env(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")


def test_returns_empty_without_supabase_credentials(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", raising=False)

    assert find_similar_rag_patterns("ありがとう") == []


def test_returns_empty_for_blank_query(monkeypatch) -> None:
    _set_supabase_env(monkeypatch)

    assert find_similar_rag_patterns("   ") == []


def test_converts_rows_and_scales_variables_to_0_100(monkeypatch) -> None:
    _set_supabase_env(monkeypatch)
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI())
    captured: dict = {}
    row = {
        "id": "7d99f633-93ad-4c5c-aae3-0e73afa177b5",
        "pattern_name": "相手の感情を気にかけている",
        "conversation_example": "[OTHER]大丈夫？しんどくない？",
        "description": "相手の感情について言及している",
        "a": 5,
        "b": 5,
        "c": 4,
        "d": 3,
        "e": 1,
        "f": 0,
        "similarity": 1.0,
    }
    monkeypatch.setattr(
        "supabase.create_client", lambda url, key: _FakeSupabaseClient([row], captured)
    )

    result = find_similar_rag_patterns("大丈夫？しんどくない？", top_k=3)

    assert captured["name"] == "match_rag_patterns"
    assert captured["params"]["match_count"] == 3
    assert result == [
        {
            "id": "7d99f633-93ad-4c5c-aae3-0e73afa177b5",
            "pattern_name": "相手の感情を気にかけている",
            "conversation_example": "[OTHER]大丈夫？しんどくない？",
            "description": "相手の感情について言及している",
            "variables": {
                "respect": 100,
                "interest": 100,
                "relationship_building": 80,
                "casual_sex_seeking": 60,
                "self_priority": 20,
                "relationship_ambiguity": 0,
            },
        }
    ]


def test_falls_back_on_error(monkeypatch) -> None:
    _set_supabase_env(monkeypatch)

    def _raise(*args: object, **kwargs: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("openai.OpenAI", _raise)

    assert find_similar_rag_patterns("ありがとう") == []
