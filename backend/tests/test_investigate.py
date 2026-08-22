from fastapi.testclient import TestClient

from app.main import TALK_HISTORY_MAX_LENGTH, app

client = TestClient(app)

REAL_EXPORT_SAMPLE = (
    "[LINE] 花子とのトーク履歴\n"
    "保存日時：2026/08/21 11:59\n"
    "\n"
    "2025/04/18(金)\n"
    "12:08\t花子\tお疲れ様です！\n"
    "14:13\t太郎\t振り込み完了しました\n"
)


def test_investigate_parses_real_export_and_returns_candidate_speakers() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", REAL_EXPORT_SAMPLE.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "received"
    assert data["filename"] == "conversation.txt"
    assert data["talk_history"] == REAL_EXPORT_SAMPLE
    assert data["candidate_speakers"] == ["太郎", "花子"]
    assert data["suggested_other_name"] == "花子"
    assert data["suggested_user_name"] == "太郎"


def test_investigate_suggests_nothing_without_a_chat_title() -> None:
    no_title_sample = (
        "2025/04/18(金)\n"
        "12:08\t花子\tお疲れ様です！\n"
        "14:13\t太郎\t振り込み完了しました\n"
    )
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", no_title_sample.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["candidate_speakers"] == ["太郎", "花子"]
    assert data["suggested_other_name"] is None
    assert data["suggested_user_name"] is None


def test_investigate_suggests_nothing_for_group_chats() -> None:
    group_sample = (
        "[LINE] 花子とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n"
        "\n"
        "2025/04/18(金)\n"
        "12:08\t花子\tお疲れ様です！\n"
        "14:13\t太郎\t振り込み完了しました\n"
        "14:20\t次郎\tよろしくお願いします\n"
    )
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", group_sample.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["suggested_other_name"] == "花子"
    assert data["suggested_user_name"] is None


def test_investigate_rejects_non_txt_file() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.pdf", REAL_EXPORT_SAMPLE.encode("utf-8"), "application/pdf")},
    )
    assert response.status_code == 400


def test_investigate_rejects_empty_file() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", b"", "text/plain")},
    )
    assert response.status_code == 422


def test_investigate_rejects_undecodable_bytes() -> None:
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", b"\xff\xfe\x00\xff", "text/plain")},
    )
    assert response.status_code == 422


def test_investigate_rejects_oversized_file() -> None:
    oversized = b"a" * (TALK_HISTORY_MAX_LENGTH + 1)
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", oversized, "text/plain")},
    )
    assert response.status_code == 422


def test_investigate_rejects_header_only_file() -> None:
    header_only = "[LINE] 花子とのトーク履歴\n保存日時：2026/08/21 11:59\n"
    response = client.post(
        "/investigate",
        files={"file": ("conversation.txt", header_only.encode("utf-8"), "text/plain")},
    )
    assert response.status_code == 422
