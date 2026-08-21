from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_investigate_accepts_txt_file() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "received", "filename": "conversation.txt"}


def test_investigate_rejects_non_txt_file() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.pdf", b"hello", "application/pdf")},
    )
    assert response.status_code == 400
