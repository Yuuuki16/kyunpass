from app.line_parser import parse, suggest_speaker_names

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


def test_messages_are_tagged_with_the_preceding_date_header() -> None:
    result = parse(REAL_EXPORT_SAMPLE, user_name="太郎", other_name="花子")

    assert all(m.date == "2025-04-18" for m in result.messages)


def test_messages_before_any_date_header_have_no_date() -> None:
    raw = "自分: 今度会える？\n相手: ありがとう！また会おう"

    result = parse(raw, user_name="自分", other_name="相手")

    assert all(m.date is None for m in result.messages)


def test_multiline_quoted_message_keeps_the_date_it_started_on() -> None:
    raw = (
        "2025/04/18(金)\n"
        '12:08\t花子\t"お疲れ様です！\n'
        'よろしくお願いします！"\n'
        "2025/04/19(土)\n"
        "09:00\t太郎\tおはよう\n"
    )

    result = parse(raw, user_name="太郎", other_name="花子")
    dates = {m.text: m.date for m in result.messages}

    assert dates["お疲れ様です！\nよろしくお願いします！"] == "2025-04-18"
    assert dates["おはよう"] == "2025-04-19"


def test_parses_timestamp_prefixed_tab_export() -> None:
    raw = (
        "2025/04/18 12:08\t花子\tお疲れ様です！\n"
        "2025/04/18 14:13\t太郎\t振り込み完了しました\n"
    )

    result = parse(raw, user_name="太郎", other_name="花子")

    assert [message.speaker for message in result.messages] == ["OTHER", "USER"]
    assert [message.date for message in result.messages] == ["2025-04-18", "2025-04-18"]


def test_parses_timestamp_prefixed_colon_export() -> None:
    raw = (
        "[2025/04/18 12:08] 花子: お疲れ様です！\n"
        "2025/04/18 14:13 太郎：振り込み完了しました\n"
        "14:20 花子: また連絡するね\n"
    )

    result = parse(raw, user_name="太郎", other_name="花子")

    assert [message.speaker for message in result.messages] == ["OTHER", "USER", "OTHER"]
    assert [message.text for message in result.messages] == [
        "お疲れ様です！",
        "振り込み完了しました",
        "また連絡するね",
    ]
    assert [message.date for message in result.messages] == ["2025-04-18"] * 3


def test_matches_names_with_full_width_and_zero_width_character_variants() -> None:
    raw = "Ｔａｒｏ: こんにちは\n花\u200b子: こんにちは"

    result = parse(raw, user_name="taro", other_name="花子")

    assert [message.speaker for message in result.messages] == ["USER", "OTHER"]
    suggested_other, suggested_user = suggest_speaker_names(["Ｔａｒｏ", "花\u200b子"], "花子")
    assert suggested_other == "花\u200b子"
    assert suggested_user == "Ｔａｒｏ"


def test_inferrs_sender_roles_from_the_chat_title_when_one_name_is_unmatched() -> None:
    raw = (
        "[LINE] 花子とのトーク履歴\n"
        "保存日時：2026/08/22 12:00\n\n"
        "2025/04/18(金)\n"
        "12:08\t花子\tお疲れ様です！\n"
        "14:13\t太郎\t振り込み完了しました\n"
    )

    result = parse(raw, user_name="自分", other_name="相手")

    assert [message.speaker for message in result.messages] == ["OTHER", "USER"]
