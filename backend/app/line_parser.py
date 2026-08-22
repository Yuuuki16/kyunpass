"""Parse raw LINE export talk_history text into speaker-tagged messages."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Kind = Literal["text", "media", "call", "reaction", "system", "unparsed"]
Speaker = Literal["USER", "OTHER", "UNKNOWN"]

HEADER_LINE_RE = re.compile(r"^(\[LINE\]\s.*|保存日時：.*)$")
CHAT_TITLE_RE = re.compile(r"^\[LINE\]\s(.+?)とのトーク履歴$")
DATE_HEADER_RE = re.compile(r"^\d{4}/\d{1,2}/\d{1,2}\([月火水木金土日]\)$")
THREE_COL_RE = re.compile(r"^(\d{1,2}:\d{2})\t([^\t]*)\t(.*)$")
TIME_ONLY_RE = re.compile(r"^(\d{1,2}:\d{2})\t(.*)$")
TWO_COL_RE = re.compile(r"^([^\t:：\n]{1,50})[:：]\s?(.+)$")
DELETED_WITH_NAME_RE = re.compile(r"^(.+?)がメッセージの送信を取り消しました$")
DELETED_NO_NAME_RE = re.compile(r"^メッセージの送信を取り消しました$")
REACTION_RE = re.compile(r"^\([^)]+\)$")
MEDIA_TEXTS = {"[写真]", "[動画]", "[ファイル]", "[スタンプ]", "[連絡先]"}
CALL_PREFIX = "☎"


@dataclass
class RawRecord:
    name: str | None
    text: str
    kind: Kind


@dataclass
class ParsedMessage:
    speaker: Speaker
    text: str
    kind: Kind


@dataclass
class ParsedHistory:
    messages: list[ParsedMessage]


def parse_header(raw: str) -> tuple[str, str | None]:
    """Drop the leading `[LINE] ...` / `保存日時：...` preamble block, if present,
    and read the counterpart's name out of a `[LINE] {name}とのトーク履歴` title line.

    LINE's export title always names the *other* participant (it is always "my
    chat with X"), so this is a reliable signal for who to suggest as other_name.
    Both are extracted in a single pass over the preamble so a multi-megabyte
    talk_history is only ever split into lines once here (title lines only ever
    appear in the header block, never in message bodies).
    """
    lines = raw.splitlines()
    index = 0
    chat_partner_name: str | None = None
    while index < len(lines):
        stripped = lines[index].strip()
        if stripped == "":
            index += 1
            continue
        if not HEADER_LINE_RE.match(stripped):
            break
        title_match = CHAT_TITLE_RE.match(stripped)
        if title_match:
            chat_partner_name = title_match.group(1).strip()
        index += 1
    return "\n".join(lines[index:]), chat_partner_name


def suggest_speaker_names(
    candidate_speakers: list[str], chat_partner_name: str | None
) -> tuple[str | None, str | None]:
    """Suggest which candidate speaker is the user and which is the other person.

    The chat title reliably names the other person, so it is trusted whenever it
    matches one of the detected speakers. The user is only suggested when exactly
    one candidate remains once the other person is known, since otherwise (group
    chats, or no title match) there is no reliable signal for who is the user.
    """
    suggested_other_name = chat_partner_name if chat_partner_name in candidate_speakers else None
    remaining_candidates = [name for name in candidate_speakers if name != suggested_other_name]
    suggested_user_name = remaining_candidates[0] if suggested_other_name and len(remaining_candidates) == 1 else None
    return suggested_other_name, suggested_user_name


def _finalize_text(text: str) -> str:
    if len(text) >= 2 and text.startswith('"') and text.endswith('"'):
        return text[1:-1]
    return text


def _classify_kind(text: str) -> Kind:
    if text in MEDIA_TEXTS:
        return "media"
    if text.startswith(CALL_PREFIX):
        return "call"
    if REACTION_RE.match(text):
        return "reaction"
    return "text"


def split_into_records(raw: str) -> list[RawRecord]:
    """Split normalized export text into (name, text, kind) records.

    Handles the real LINE export's `HH:MM\\t名前\\t本文` columns as well as the
    simplified `名前: 本文` format, and joins messages that span multiple
    physical lines inside a leading/trailing `"` (LINE's CSV-style quoting for
    embedded newlines).
    """
    records: list[RawRecord] = []
    buffer_name: str | None = None
    buffer_lines: list[str] | None = None

    def flush_buffer() -> None:
        nonlocal buffer_name, buffer_lines
        if buffer_lines is not None:
            text = _finalize_text("\n".join(buffer_lines))
            records.append(RawRecord(name=buffer_name, text=text, kind=_classify_kind(text)))
        buffer_name, buffer_lines = None, None

    for raw_line in raw.splitlines():
        line = raw_line.rstrip("\r")

        if buffer_lines is not None:
            buffer_lines.append(line)
            if line.rstrip().endswith('"'):
                flush_buffer()
            continue

        stripped = line.strip()
        if not stripped or DATE_HEADER_RE.match(stripped):
            continue

        match = THREE_COL_RE.match(line)
        if match:
            _, name, text = match.groups()
            name = name.strip() or None
        else:
            match = TIME_ONLY_RE.match(line)
            if match:
                name, text = None, match.group(2)
            else:
                match = TWO_COL_RE.match(stripped)
                if match:
                    name, text = match.groups()
                    name = name.strip() or None
                else:
                    name, text = None, stripped

        deleted_with_name = DELETED_WITH_NAME_RE.match(text)
        if deleted_with_name:
            records.append(RawRecord(name=deleted_with_name.group(1).strip(), text=text, kind="system"))
            continue
        if DELETED_NO_NAME_RE.match(text):
            records.append(RawRecord(name=None, text=text, kind="system"))
            continue

        if text.startswith('"') and text.count('"') % 2 == 1:
            buffer_name, buffer_lines = name, [text]
            continue

        text = _finalize_text(text)
        if name is None:
            records.append(RawRecord(name=None, text=text, kind="unparsed"))
            continue

        records.append(RawRecord(name=name, text=text, kind=_classify_kind(text)))

    flush_buffer()
    return records


def classify_speaker(name: str | None, user_name: str, other_name: str) -> Speaker:
    if name == user_name:
        return "USER"
    if name == other_name:
        return "OTHER"
    return "UNKNOWN"


def parse(raw: str, user_name: str, other_name: str) -> ParsedHistory:
    body, _ = parse_header(raw)
    records = split_into_records(body)
    messages = [
        ParsedMessage(speaker=classify_speaker(record.name, user_name, other_name), text=record.text, kind=record.kind)
        for record in records
    ]
    return ParsedHistory(messages=messages)
