from fastapi.testclient import TestClient

from app.main import app

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
