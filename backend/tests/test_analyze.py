import json
import sys
import types

from fastapi.testclient import TestClient

from app.main import (
    VARIABLE_LABELS,
    SeparatedMessage,
    analysis_chunks,
    app,
    average_observed_variables,
    build_llm_prompt,
    calculate_f,
    fallback_evaluation,
    fallback_evidence,
    mask_vulgar_words,
    retrieve_patterns_for_chunks,
    theme_evaluations,
    verify_other_quotes,
)

client = TestClient(app)


def test_context_options_contains_agreed_meeting_coefficients() -> None:
    response = client.get("/context-options")

    assert response.status_code == 200
    assert response.json()["B"]["B1"]["coefficient"] == 1.0
    assert response.json()["B"]["B4"]["coefficient"] == 0.8


def test_analyze_separates_speakers_and_calculates_score() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n相手: ありがとう！また会おう\n相手: 無理しないでね",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["context_score"] == 0.64
    assert [message["speaker"] for message in data["separated_messages"]] == ["USER", "OTHER", "OTHER"]
    assert data["variables"]["respect"] == 4
    assert all(0 <= value <= 5 for value in data["variables"].values())
    assert data["kyun_score"] == int(
      data["function_score"] * data["context_score"]
  )
    assert "ありがとう！また会おう" in data["kyun_messages"]
    assert data["caution_messages"] == []


def test_analyze_rejects_talk_history_without_other_speaker() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 好き\n自分: また会おう",
        },
    )

    assert response.status_code == 422


def test_analyze_rejects_unknown_context_option() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A9", "meeting": "B1", "relationship": "C1"},
            "talk_history": "相手: こんにちは",
        },
    )

    assert response.status_code == 422


def test_analyze_accepts_real_line_export_format() -> None:
    talk_history = (
        "[LINE] 相手とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:09\t相手\tありがとう！また会おう\n"
    )
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    speakers = [message["speaker"] for message in response.json()["separated_messages"]]
    assert speakers == ["USER", "OTHER"]


def test_analyze_accepts_timestamp_prefixed_line_export_format() -> None:
    talk_history = (
        "[2025/04/18 12:08] 自分: 今度会える？\n"
        "2025/04/18 12:09 相手: ありがとう！また会おう\n"
        "12:10 相手: 無理しないでね\n"
    )
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    assert [message["speaker"] for message in response.json()["separated_messages"]] == [
        "USER",
        "OTHER",
        "OTHER",
    ]


def test_analyze_infers_speakers_from_one_to_one_chat_title() -> None:
    talk_history = (
        "[LINE] 花子とのトーク履歴\n"
        "保存日時：2026/08/22 12:00\n\n"
        "2025/04/18(金)\n"
        "12:08\t花子\tありがとう！また会おう\n"
        "12:09\t太郎\t今度会える？\n"
    )
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    assert [message["speaker"] for message in response.json()["separated_messages"]] == [
        "OTHER",
        "USER",
    ]


def test_analyze_returns_timeline_bucketed_by_date() -> None:
    talk_history = (
        "[LINE] 相手とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:09\t相手\tありがとう！また会おう\n"
        "2025/04/19(土)\n"
        "09:00\t相手\t無理しないでね\n"
    )
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    timeline = response.json()["timeline"]
    assert [point["date"] for point in timeline] == ["2025-04-18", "2025-04-19"]
    assert all(0 <= point["kyun_score"] <= 100 for point in timeline)
    assert timeline[0]["message_count"] == 2
    assert timeline[1]["message_count"] == 1


def test_analyze_timeline_omits_dates_with_no_other_text_message() -> None:
    talk_history = (
        "[LINE] 相手とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:08\t相手\t[写真]\n"
        "2025/04/19(土)\n"
        "09:00\t相手\t無理しないでね\n"
    )
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    timeline = response.json()["timeline"]
    assert [point["date"] for point in timeline] == ["2025-04-19"]


def test_build_llm_prompt_lists_qualifying_timeline_dates() -> None:
    messages = [
        SeparatedMessage(speaker="OTHER", text="ありがとう", date="2025-04-18"),
        SeparatedMessage(speaker="USER", text="今度会える？", date="2025-04-19"),
    ]

    prompt = build_llm_prompt(messages, [], {"period": "", "meeting": "", "relationship": ""}, user_name="太郎", other_name="花子")

    instruction_section = prompt.split("Conversation:")[0]
    assert "2025-04-18" in instruction_section
    assert "2025-04-19" not in instruction_section
    assert "[2025-04-18][花子] ありがとう" in prompt


def test_build_llm_prompt_timeline_empty_when_no_dates() -> None:
    prompt = build_llm_prompt(
        [SeparatedMessage(speaker="OTHER", text="ありがとう")],
        [],
        {"period": "", "meeting": "", "relationship": ""},
        user_name="太郎",
        other_name="花子",
    )

    assert "return an empty array" in prompt


def test_analyze_uses_llm_timeline_when_available(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    talk_history = (
        "[LINE] 相手とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:09\t相手\tありがとう！また会おう\n"
        "2025/04/19(土)\n"
        "09:00\t相手\t無理しないでね\n"
    )
    llm_output = json.dumps(
        {
            "a": 3,
            "b": 3,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "kyun_messages": [],
            "caution_messages": [],
            "evaluation": "LLMによる評価テキスト",
            "timeline": [
                {"date": "2025-04-18", "a": 5, "b": 5, "c": 4, "d": 0, "e": 0, "f": 0},
                {"date": "2025-04-19", "a": 1, "b": 0, "c": 0, "d": 4, "e": 3, "f": 2},
            ],
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    timeline = response.json()["timeline"]
    assert [point["date"] for point in timeline] == ["2025-04-18", "2025-04-19"]
    assert timeline[0]["variables"]["respect"] == 5
    assert timeline[1]["variables"]["casual_sex_seeking"] == 4
    assert timeline[0]["kyun_score"] > timeline[1]["kyun_score"]

    prompt = captured["input"]
    assert '"2025-04-18"' in prompt
    assert '"2025-04-19"' in prompt


def test_analyze_falls_back_to_keyword_timeline_for_dates_llm_omits(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    talk_history = (
        "[LINE] 相手とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:09\t相手\tありがとう！また会おう\n"
        "2025/04/19(土)\n"
        "09:00\t相手\t無理しないでね\n"
    )
    llm_output = json.dumps(
        {
            "a": 3,
            "b": 3,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "kyun_messages": [],
            "caution_messages": [],
            "evaluation": "LLMによる評価テキスト",
            "timeline": [
                {"date": "2025-04-18", "a": 5, "b": 5, "c": 4, "d": 0, "e": 0, "f": 0},
            ],
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": talk_history,
        },
    )

    assert response.status_code == 200
    timeline = response.json()["timeline"]
    assert timeline[0]["variables"]["respect"] == 5
    assert timeline[1]["variables"] == {"respect": 3, "interest": 0, "relationship_building": 0, "casual_sex_seeking": 0, "self_priority": 0, "relationship_ambiguity": 0}


def test_analyze_rejects_when_user_name_never_appears() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "相手: こんにちは\n相手: 元気？",
        },
    )

    assert response.status_code == 422


def test_analyze_rejects_when_unknown_speaker_ratio_too_high() -> None:
    lines = ["自分: こんにちは", "相手: どうも"] + [f"だれか{i}: メッセージ{i}" for i in range(6)]
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "\n".join(lines),
        },
    )

    assert response.status_code == 422


def test_analyze_rejects_when_unparsed_line_ratio_too_high() -> None:
    lines = ["自分: こんにちは", "相手: どうも"] + [f"名前も区切りも無いゴミ行{i}" for i in range(6)]
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "\n".join(lines),
        },
    )

    assert response.status_code == 422


def test_analyze_rejects_same_user_and_other_name() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "同じ",
            "other_name": "同じ",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "同じ: こんにちは",
        },
    )

    assert response.status_code == 422


def test_build_llm_prompt_includes_names_and_context_labels() -> None:
    messages = [
        SeparatedMessage(speaker="USER", text="今度会える？"),
        SeparatedMessage(speaker="OTHER", text="また会おう"),
    ]
    labels = {"period": "1週間未満", "meeting": "友人・知人の紹介", "relationship": "ほとんど面識がない"}

    prompt = build_llm_prompt(messages, [], labels, user_name="太郎", other_name="花子")

    assert "[太郎] 今度会える？" in prompt
    assert "[花子] また会おう" in prompt
    assert "1週間未満" in prompt
    assert "友人・知人の紹介" in prompt
    assert "ほとんど面識がない" in prompt


def test_build_llm_prompt_instructs_warning_for_danger_signals() -> None:
    prompt = build_llm_prompt([], [], {"period": "", "meeting": "", "relationship": ""}, user_name="太郎", other_name="花子")

    assert "kyun_messages" in prompt
    assert "caution_messages" in prompt
    assert "引き止める" in prompt
    assert "純粋" in prompt


def test_fallback_evidence_extracts_matching_other_messages() -> None:
    messages = [
        SeparatedMessage(speaker="USER", text="今度会える？"),
        SeparatedMessage(speaker="OTHER", text="ありがとう！また会おうね"),
        SeparatedMessage(speaker="OTHER", text="今すぐホテル行こうよ"),
        SeparatedMessage(speaker="OTHER", text="今日は天気がいいね"),
    ]

    kyun_messages, caution_messages = fallback_evidence(messages)

    assert "ありがとう！また会おうね" in kyun_messages
    assert "今すぐホテル行こうよ" in caution_messages
    assert "今日は天気がいいね" not in kyun_messages
    assert "今日は天気がいいね" not in caution_messages


def test_verify_other_quotes_drops_quotes_not_from_other() -> None:
    messages = [
        SeparatedMessage(speaker="USER", text="今度会える？"),
        SeparatedMessage(speaker="OTHER", text="ありがとう！また会おうね"),
    ]

    verified = verify_other_quotes(messages, ["ありがとう！また会おうね", "今度会える？", "存在しない発言"])

    assert verified == ["ありがとう！また会おうね"]


def test_variable_labels_avoid_vulgar_wording() -> None:
    assert "セックス" not in VARIABLE_LABELS["casual_sex_seeking"]
    assert "エッチ" not in VARIABLE_LABELS["casual_sex_seeking"]


def test_build_llm_prompt_instructs_avoiding_vulgar_wording() -> None:
    prompt = build_llm_prompt([], [], {"period": "", "meeting": "", "relationship": ""}, user_name="太郎", other_name="花子")

    assert "vulgar" in prompt.lower()


def test_mask_vulgar_words_replaces_known_terms() -> None:
    assert mask_vulgar_words("今すぐエッチしよう") == "今すぐ●●●しよう"
    assert mask_vulgar_words("セフレにならない？") == "●●●にならない？"
    assert mask_vulgar_words("また会おうね") == "また会おうね"


def test_analyze_masks_vulgar_words_in_caution_messages() -> None:
    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n相手: 今すぐエッチしよう\n相手: セフレにならない？",
        },
    )

    assert response.status_code == 200
    data = response.json()
    joined = " ".join(data["caution_messages"])
    assert "エッチ" not in joined
    assert "セフレ" not in joined
    assert "●" in joined


def test_fallback_evaluation_warns_when_danger_signal_is_high() -> None:
    values = {"respect": 3, "interest": 3, "relationship_building": 3, "casual_sex_seeking": 4, "self_priority": 1, "relationship_ambiguity": 1}

    evaluation = fallback_evaluation(30, values)

    assert "立ち止まって" in evaluation


def _variables(**overrides: int) -> dict[str, int]:
    values = {key: 0 for key in VARIABLE_LABELS}
    values.update(overrides)
    return values


def test_average_observed_variables_excludes_unobserved_zeroes() -> None:
    averaged = average_observed_variables(
        [
            _variables(interest=5),
            _variables(),
            _variables(interest=4),
            _variables(),
            _variables(interest=3),
        ]
    )

    assert averaged["interest"] == 4


def test_average_observed_variables_keeps_all_unobserved_values_at_zero() -> None:
    averaged = average_observed_variables(
        [_variables(relationship_ambiguity=0) for _ in range(3)]
    )

    assert averaged["relationship_ambiguity"] == 0


def test_average_observed_variables_keeps_unscored_variables_unobserved() -> None:
    averaged = average_observed_variables([_variables(respect=4)])

    assert averaged["respect"] == 4
    assert averaged["interest"] == 0
    assert averaged["relationship_ambiguity"] == 0


def test_calculate_f_maps_the_new_scale_to_the_existing_formula() -> None:
    assert calculate_f(_variables()) == 50
    assert calculate_f(
        _variables(respect=5, interest=5, relationship_building=5)
    ) == 100


def test_build_llm_prompt_defines_unobserved_zero_and_a_to_f_output() -> None:
    prompt = build_llm_prompt(
        [],
        [],
        {"period": "", "meeting": "", "relationship": ""},
        user_name="太郎",
        other_name="花子",
    )

    assert "0 means" in prompt
    assert "integer 0-5 values for a, b, c, d, e, f" in prompt
    assert "Intimate topics alone are not evidence" in prompt


def test_rag_retrieval_keeps_embedding_model_and_rpc_top_five(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-supabase-key")
    captured: dict[str, object] = {}

    class FakeEmbeddings:
        def create(self, **kwargs: object) -> object:
            captured["embedding_request"] = kwargs
            inputs = kwargs["input"]
            return types.SimpleNamespace(
                data=[types.SimpleNamespace(embedding=[0.0] * 1536) for _ in inputs]
            )

    class FakeOpenAI:
        def __init__(self) -> None:
            self.embeddings = FakeEmbeddings()

    class FakeSupabase:
        def rpc(self, name: str, arguments: dict[str, object]) -> "FakeSupabase":
            captured["rpc_name"] = name
            captured["rpc_arguments"] = arguments
            return self

        def execute(self) -> object:
            return types.SimpleNamespace(
                data=[
                    {
                        "id": index,
                        "conversation_example": f"example {index}",
                        "description": f"description {index}",
                        "a": 0,
                        "b": 0,
                        "c": 0,
                        "d": 0,
                        "e": 0,
                        "f": 0,
                        "similarity": 0.9 - index / 100,
                    }
                    for index in range(6)
                ]
            )

    fake_supabase_module = types.ModuleType("supabase")
    fake_supabase_module.create_client = lambda url, key: FakeSupabase()
    monkeypatch.setitem(sys.modules, "supabase", fake_supabase_module)
    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)

    chunks = analysis_chunks(
        [
            SeparatedMessage(speaker="USER", text="今度会える？"),
            SeparatedMessage(speaker="OTHER", text="また会おう"),
        ]
    )
    pattern_sets = retrieve_patterns_for_chunks(chunks)

    assert captured["embedding_request"]["model"] == "text-embedding-3-small"
    assert captured["embedding_request"]["input"] == [chunks[0].text]
    assert len(captured["rpc_arguments"]["query_embedding"]) == 1536
    assert captured["rpc_name"] == "match_rag_patterns"
    assert captured["rpc_arguments"]["match_count"] == 5
    assert len(pattern_sets) == 1
    assert len(pattern_sets[0]) == 5


def test_theme_evaluations_returns_three_softened_impressions() -> None:
    values = _variables(
        respect=1,
        interest=1,
        relationship_building=1,
        casual_sex_seeking=4,
    )

    evaluations = theme_evaluations(values)

    assert set(evaluations) == {
        "casual_sex_seeking",
        "self_priority",
        "relationship_ambiguity",
    }
    assert "立ち止まって" in evaluations["casual_sex_seeking"]
    assert "サインは強くありません" in evaluations["self_priority"]


class _FakeResponse:
    def __init__(self, output_text: str) -> None:
        self.output_text = output_text


class _FakeResponses:
    def __init__(self, output_text: str, captured: dict) -> None:
        self._output_text = output_text
        self._captured = captured

    def create(self, **kwargs: object) -> _FakeResponse:
        self._captured.update(kwargs)
        return _FakeResponse(self._output_text)


class _FakeOpenAI:
    def __init__(self, output_text: str, captured: dict) -> None:
        self.responses = _FakeResponses(output_text, captured)


def test_analyze_uses_llm_result_when_available(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    llm_output = json.dumps(
        {
            "a": 5,
            "b": 4,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "kyun_messages": ["ありがとう！また会おう"],
            "caution_messages": [],
            "evaluation": "LLMによる評価テキスト",
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "花子",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n花子: ありがとう！また会おう",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["variables"]["respect"] == 5
    assert data["evaluation"] == "LLMによる評価テキスト"
    assert data["kyun_messages"] == ["ありがとう！また会おう"]
    assert data["caution_messages"] == []

    prompt = captured["input"]
    assert "花子" in prompt
    assert "自分" in prompt
    assert "1週間未満" in prompt
    assert "友人・知人の紹介" in prompt
    assert captured["text"]["format"]["type"] == "json_schema"


def test_analyze_drops_llm_quotes_not_actually_from_other(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    llm_output = json.dumps(
        {
            "a": 5,
            "b": 4,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "kyun_messages": ["ありがとう！また会おう", "今度会える？"],
            "caution_messages": ["でっちあげの発言"],
            "evaluation": "LLMによる評価テキスト",
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "花子",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n花子: ありがとう！また会おう",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["kyun_messages"] == ["ありがとう！また会おう"]
    assert data["caution_messages"] == []


def test_analyze_falls_back_when_llm_raises(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def _raise() -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("openai.OpenAI", _raise)

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n相手: ありがとう！また会おう\n相手: 無理しないでね",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["variables"]["respect"] == 4


def test_analyze_falls_back_when_llm_evaluation_is_empty(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    llm_output = json.dumps(
        {
            "a": 5,
            "b": 4,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "evaluation": "   ",
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "相手",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n相手: ありがとう！また会おう\n相手: 無理しないでね",
        },
    )

    assert response.status_code == 200
    data = response.json()
    # LLMの評価文が空なら、スコアと評価文の食い違いを避けるため両方ともフォールバック値になる。
    assert data["variables"]["respect"] != 5
    assert data["evaluation"] != "   "


def test_analyze_includes_retrieved_similar_patterns(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    llm_output = json.dumps(
        {
            "a": 5,
            "b": 4,
            "c": 3,
            "d": 0,
            "e": 0,
            "f": 0,
            "kyun_messages": ["ありがとう！また会おう"],
            "caution_messages": [],
            "evaluation": "LLMによる評価テキスト",
        }
    )
    monkeypatch.setattr("openai.OpenAI", lambda: _FakeOpenAI(llm_output, captured))
    retrieved_patterns = [
        {
            "id": "7d99f633-93ad-4c5c-aae3-0e73afa177b5",
            "pattern_name": "相手の感情を気にかけている",
            "conversation_example": "[OTHER]大丈夫？しんどくない？",
            "description": "相手の感情について言及している",
            "similarity": 0.9,
        }
    ]
    monkeypatch.setattr(
        "app.main.retrieve_patterns_for_chunks",
        lambda chunks: [retrieved_patterns for _ in chunks],
    )

    response = client.post(
        "/analyze",
        json={
            "user_name": "自分",
            "other_name": "花子",
            "context": {"period": "A1", "meeting": "B1", "relationship": "C1"},
            "talk_history": "自分: 今度会える？\n花子: ありがとう！また会おう",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["similar_patterns"] == retrieved_patterns
    assert "相手の感情を気にかけている" in captured["input"]
