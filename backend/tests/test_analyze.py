import json

from fastapi.testclient import TestClient

from app.main import SeparatedMessage, app, build_llm_prompt

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
    assert data["variables"]["respect"] > 20
    assert data["kyun_score"] == int(
      data["function_score"] * data["context_score"]
  )


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
            "respect": 90,
            "interest": 80,
            "relationship_building": 70,
            "casual_sex_seeking": 0,
            "self_priority": 0,
            "relationship_ambiguity": 0,
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
    assert data["variables"]["respect"] == 90
    assert data["evaluation"] == "LLMによる評価テキスト"

    prompt = captured["input"]
    assert "花子" in prompt
    assert "自分" in prompt
    assert "1週間未満" in prompt
    assert "友人・知人の紹介" in prompt
    assert captured["text"]["format"]["type"] == "json_schema"


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
    assert data["variables"]["respect"] > 20


def test_analyze_falls_back_when_llm_evaluation_is_empty(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    captured: dict = {}
    llm_output = json.dumps(
        {
            "respect": 90,
            "interest": 80,
            "relationship_building": 70,
            "casual_sex_seeking": 0,
            "self_priority": 0,
            "relationship_ambiguity": 0,
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
    assert data["variables"]["respect"] != 90
    assert data["evaluation"] != "   "
