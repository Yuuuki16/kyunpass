from fastapi.testclient import TestClient

from app.main import app
from app.rag_chunker import chunk_talk_history


client = TestClient(app)


def test_chunk_talk_history_formats_only_recognized_text_messages() -> None:
    history = (
        "[LINE] 花子とのトーク履歴\n"
        "保存日時：2026/08/21 11:59\n\n"
        "2025/04/18(金)\n"
        "12:08\t自分\t今度会える？\n"
        "12:09\t花子\t[写真]\n"
        "12:10\t花子\tまた会おう\n"
        "12:11\t第三者\tこの発言は含めない\n"
    )

    chunks = chunk_talk_history(history, user_name="自分", other_name="花子")

    assert len(chunks) == 1
    assert chunks[0].text == "[USER] 今度会える？\n[OTHER] また会おう"
    assert chunks[0].source_message_start == 0
    assert chunks[0].source_message_end == 2
    assert chunks[0].message_count == 2
    assert chunks[0].speakers == ("USER", "OTHER")


def test_chunk_talk_history_creates_bounded_overlapping_chunks() -> None:
    history = "\n".join(
        [
            f"自分: {'a' * 35}",
            f"花子: {'b' * 35}",
            f"自分: {'c' * 35}",
            f"花子: {'d' * 35}",
        ]
    )

    chunks = chunk_talk_history(
        history,
        user_name="自分",
        other_name="花子",
        max_chunk_chars=100,
        overlap_messages=1,
    )

    assert [chunk.text for chunk in chunks] == [
        f"[USER] {'a' * 35}\n[OTHER] {'b' * 35}",
        f"[OTHER] {'b' * 35}\n[USER] {'c' * 35}",
        f"[USER] {'c' * 35}\n[OTHER] {'d' * 35}",
    ]
    assert [(chunk.source_message_start, chunk.source_message_end) for chunk in chunks] == [
        (0, 1),
        (1, 2),
        (2, 3),
    ]
    assert all(len(chunk.text) <= 100 for chunk in chunks)


def test_chunk_talk_history_splits_an_exceptionally_long_message() -> None:
    chunks = chunk_talk_history(
        f"花子: {'あ' * 150}",
        user_name="自分",
        other_name="花子",
        max_chunk_chars=100,
        overlap_messages=0,
    )

    assert len(chunks) == 2
    assert all(chunk.text.startswith("[OTHER] ") for chunk in chunks)
    assert all(len(chunk.text) <= 100 for chunk in chunks)
    assert [(chunk.source_message_start, chunk.source_message_end) for chunk in chunks] == [
        (0, 0),
        (0, 0),
    ]


def test_rag_chunk_endpoint_returns_embedding_ready_chunks() -> None:
    response = client.post(
        "/rag/chunks",
        json={
            "user_name": "自分",
            "other_name": "花子",
            "talk_history": "自分: 今度会える？\n花子: ありがとう。また会おう",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "chunk_count": 1,
        "chunks": [
            {
                "index": 0,
                "text": "[USER] 今度会える？\n[OTHER] ありがとう。また会おう",
                "source_message_start": 0,
                "source_message_end": 1,
                "message_count": 2,
                "speakers": ["USER", "OTHER"],
            }
        ],
    }


def test_rag_chunk_endpoint_rejects_a_history_without_recognized_text() -> None:
    response = client.post(
        "/rag/chunks",
        json={
            "user_name": "自分",
            "other_name": "花子",
            "talk_history": "第三者: 発言\n花子: [写真]",
        },
    )

    assert response.status_code == 422
