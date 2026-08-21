from app.line_parser import parse

REAL_EXPORT_SAMPLE = (
    "[LINE] 花子とのトーク履歴\n"
    "保存日時：2026/08/21 11:59\n"
    "\n"
    "2025/04/18(金)\n"
    '12:08\t花子\t"お疲れ様です！\n'
    'よろしくお願いします！"\n'
    "12:08\t花子\t[写真]\n"
    "14:13\t太郎\t振り込み完了しました\n"
    "21:38\t花子\t☎ 不在着信\n"
    "22:00\t花子\t(emoji)\n"
    "22:05\t\tメッセージの送信を取り消しました\n"
    "22:10\t花子がメッセージの送信を取り消しました\n"
)


def test_parses_three_column_export_and_joins_multiline_quote() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")

    text_messages = {m.text: m for m in result.messages if m.kind == "text"}
    assert "お疲れ様です！\nよろしくお願いします！" in text_messages
    assert text_messages["お疲れ様です！\nよろしくお願いします！"].speaker == "OTHER"
    assert text_messages["振り込み完了しました"].speaker == "USER"


def test_header_and_date_lines_are_not_messages() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")

    assert all("トーク履歴" not in m.text for m in result.messages)
    assert all("保存日時" not in m.text for m in result.messages)
    assert all(m.text != "2025/04/18(金)" for m in result.messages)


def test_media_call_and_reaction_kinds_are_classified() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")
    kinds = {m.text: m.kind for m in result.messages}

    assert kinds["[写真]"] == "media"
    assert kinds["☎ 不在着信"] == "call"
    assert kinds["(emoji)"] == "reaction"


def test_deleted_message_with_embedded_name_gets_that_speaker() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")
    deleted = next(m for m in result.messages if m.text == "花子がメッセージの送信を取り消しました")

    assert deleted.kind == "system"
    assert deleted.speaker == "OTHER"


def test_deleted_message_without_name_is_unknown_speaker() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")
    deleted = next(m for m in result.messages if m.text == "メッセージの送信を取り消しました")

    assert deleted.kind == "system"
    assert deleted.speaker == "UNKNOWN"


def test_simple_two_column_format_still_parses() -> None:
    raw = "自分: 今度会える？\n相手: ありがとう！また会おう"

    result = parse(raw, user_name="自分", other_name="相手")

    assert [m.speaker for m in result.messages] == ["USER", "OTHER"]
    assert [m.text for m in result.messages] == ["今度会える？", "ありがとう！また会おう"]
