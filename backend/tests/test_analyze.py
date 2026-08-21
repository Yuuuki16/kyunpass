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
