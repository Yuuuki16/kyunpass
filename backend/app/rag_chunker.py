"""Convert parsed LINE talk histories into retrieval-friendly text chunks."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from app.line_parser import ParsedMessage, Speaker, parse as parse_talk_history


@dataclass(frozen=True)
class RagChunk:
    """One text payload ready to be embedded and stored in a vector database.

    ``source_message_start`` and ``source_message_end`` are zero-based, inclusive
    indexes into the parsed LINE messages.  They make it possible for a caller to
    link a retrieved chunk back to the original conversation without storing the
    complete transcript in the embedding text.
    """

    index: int
    text: str
    source_message_start: int
    source_message_end: int
    message_count: int
    speakers: tuple[Speaker, ...]


@dataclass(frozen=True)
class _RagMessage:
    text: str
    source_index: int
    speaker: Speaker


def _split_long_text(text: str, maximum_length: int) -> list[str]:
    """Split a single message only when it cannot fit in a chunk.

    Prefer natural Japanese and whitespace boundaries, but always make progress
    for text without separators such as a long URL.
    """
    if len(text) <= maximum_length:
        return [text]

    pieces: list[str] = []
    remaining = text
    separators = "\n。！？、,.!? "
    while len(remaining) > maximum_length:
        candidate = remaining[:maximum_length]
        split_at = max(candidate.rfind(separator) for separator in separators)
        # Do not create a very short piece merely because a separator appears at
        # the beginning of the candidate.
        cut_at = split_at + 1 if split_at >= maximum_length // 2 else maximum_length
        pieces.append(remaining[:cut_at].strip())
        remaining = remaining[cut_at:].strip()
    if remaining:
        pieces.append(remaining)
    return pieces


def _to_rag_messages(
    messages: Iterable[ParsedMessage], max_chunk_chars: int
) -> list[_RagMessage]:
    rag_messages: list[_RagMessage] = []
    for source_index, message in enumerate(messages):
        if message.kind != "text" or message.speaker == "UNKNOWN":
            continue

        content = message.text.strip()
        if not content:
            continue

        prefix = f"[{message.speaker}] "
        max_content_chars = max_chunk_chars - len(prefix)
        for part in _split_long_text(content, max_content_chars):
            rag_messages.append(
                _RagMessage(
                    text=f"{prefix}{part}",
                    source_index=source_index,
                    speaker=message.speaker,
                )
            )
    return rag_messages


def chunk_messages(
    messages: Sequence[ParsedMessage],
    *,
    max_chunk_chars: int = 1_200,
    overlap_messages: int = 2,
) -> list[RagChunk]:
    """Create bounded, overlapping RAG chunks from parsed LINE messages.

    Non-text events (images, calls, reactions, and system messages) and unknown
    speakers are omitted because they do not produce reliable semantic search
    text.  A normal message is never split across chunks; an exceptionally long
    individual message is split at a natural boundary so every returned chunk
    respects ``max_chunk_chars``.
    """
    if max_chunk_chars < 16:
        raise ValueError("max_chunk_chars must be at least 16.")
    if overlap_messages < 0:
        raise ValueError("overlap_messages must be zero or greater.")

    rag_messages = _to_rag_messages(messages, max_chunk_chars)
    chunks: list[RagChunk] = []
    start = 0
    while start < len(rag_messages):
        end = start
        selected_messages: list[_RagMessage] = []
        current_length = 0

        while end < len(rag_messages):
            candidate = rag_messages[end]
            separator_length = 1 if selected_messages else 0
            candidate_length = current_length + separator_length + len(candidate.text)
            if selected_messages and candidate_length > max_chunk_chars:
                break
            selected_messages.append(candidate)
            current_length = candidate_length
            end += 1

        source_indexes = [message.source_index for message in selected_messages]
        speakers = tuple(dict.fromkeys(message.speaker for message in selected_messages))
        chunks.append(
            RagChunk(
                index=len(chunks),
                text="\n".join(message.text for message in selected_messages),
                source_message_start=min(source_indexes),
                source_message_end=max(source_indexes),
                message_count=len(selected_messages),
                speakers=speakers,
            )
        )

        if end == len(rag_messages):
            break

        # Keep the requested context, while guaranteeing progress when the
        # overlap is equal to or larger than the just-created chunk.
        start = max(start + 1, end - overlap_messages)

    return chunks


def chunk_talk_history(
    talk_history: str,
    user_name: str,
    other_name: str,
    *,
    max_chunk_chars: int = 1_200,
    overlap_messages: int = 2,
) -> list[RagChunk]:
    """Parse a raw LINE export and create RAG chunks for the chosen two people."""
    parsed = parse_talk_history(
        talk_history,
        user_name,
        other_name,
        infer_speakers=False,
    )
    return chunk_messages(
        parsed.messages,
        max_chunk_chars=max_chunk_chars,
        overlap_messages=overlap_messages,
    )
