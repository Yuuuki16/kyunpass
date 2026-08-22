"""Kyun score API."""
from __future__ import annotations

import json
import logging
import os
from typing import Literal, NamedTuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from app.line_parser import parse as parse_talk_history
from app.line_parser import parse_header, split_into_records, suggest_speaker_names
from app.rag_chunker import RagChunk, chunk_talk_history
from app.rag_pattern_search import find_similar_rag_patterns

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="kyunpass API", version="0.1.0")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

UNKNOWN_RATIO_THRESHOLD = 0.5
MIN_TEXT_MESSAGES_FOR_RATIO_CHECK = 5
TALK_HISTORY_MAX_LENGTH = 2_000_000
OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "30"))
DANGER_THRESHOLD = 50
MAX_EVIDENCE_MESSAGES = 5
MAX_SIMILAR_PATTERNS = 3
MAX_LLM_INPUT_MESSAGES = 2000

CONTEXT_OPTIONS: dict[str, dict[str, dict[str, float | str]]] = {
    "A": {"A1": {"label": "1週間未満", "coefficient": 0.8}, "A2": {"label": "1週間〜1か月", "coefficient": 0.85}, "A3": {"label": "1〜3か月", "coefficient": 0.9}, "A4": {"label": "3か月〜1年", "coefficient": 0.95}, "A5": {"label": "1年以上", "coefficient": 1.0}},
    "B": {"B1": {"label": "友人・知人の紹介", "coefficient": 1.0}, "B2": {"label": "学校・大学・サークル", "coefficient": 0.8}, "B3": {"label": "バイト・職場", "coefficient": 0.8}, "B4": {"label": "SNS・オンライン", "coefficient": 0.8}, "B5": {"label": "趣味・イベント", "coefficient": 0.9}, "B6": {"label": "偶然", "coefficient": 0.9}},
    "C": {"C1": {"label": "ほとんど面識がない", "coefficient": 0.8}, "C2": {"label": "知り合い", "coefficient": 0.85}, "C3": {"label": "友人", "coefficient": 0.9}, "C4": {"label": "恋人", "coefficient": 1.0}},
}
VARIABLE_LABELS = {"respect": "相手を尊重している", "interest": "相手に関心を持っている", "relationship_building": "継続的な関係性を築こうとしている", "casual_sex_seeking": "身体的な関係を急いでいる", "self_priority": "自分を優先している", "relationship_ambiguity": "恋愛関係を曖昧にしている"}
WORDS = {"respect": ("ありがとう", "ごめん", "無理しないで", "大丈夫"), "interest": ("好き", "趣味", "仕事", "体調", "元気"), "relationship_building": ("また", "今度", "会おう", "一緒に", "予定"), "casual_sex_seeking": ("ホテル", "泊ま", "セフレ", "エッチ", "体の関係"), "self_priority": ("俺の都合", "私の都合", "今すぐ", "してよ"), "relationship_ambiguity": ("友達のまま", "曖昧", "付き合えない", "まだ決められない")}
VULGAR_WORDS = ("セフレ", "エッチ", "ヤリモク", "ヤリ捨て", "SEX", "sex")

def mask_vulgar_words(text: str) -> str:
    for word in VULGAR_WORDS:
        text = text.replace(word, "●" * len(word))
    return text


class ContextSelection(BaseModel):
    period: str
    meeting: str
    relationship: str

class AnalyzeRequest(BaseModel):
    user_name: str = Field(min_length=1, max_length=100)
    other_name: str = Field(min_length=1, max_length=100)
    context: ContextSelection
    talk_history: str = Field(min_length=1, max_length=TALK_HISTORY_MAX_LENGTH)

    @field_validator("user_name", "other_name")
    @classmethod
    def strip_names(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def check_names_distinct(self) -> AnalyzeRequest:
        if self.user_name == self.other_name:
            raise ValueError("user_name and other_name must be different.")
        return self

class SeparatedMessage(BaseModel):
    speaker: Literal["USER", "OTHER", "UNKNOWN"]
    text: str
    kind: Literal["text", "media", "call", "reaction", "system", "unparsed"] = "text"
    date: str | None = None

class TimelinePoint(BaseModel):
    date: str
    kyun_score: int = Field(ge=0, le=100)
    function_score: int = Field(ge=0, le=100)
    variables: dict[str, int]
    message_count: int

class AnalyzeResponse(BaseModel):

    kyun_score: int = Field(ge=0, le=100)
    function_score: int = Field(ge=0, le=100)
    context_score: float = Field(gt=0, le=1)
    variables: dict[str, int]
    variable_labels: dict[str, str]
    separated_messages: list[SeparatedMessage]
    similar_patterns: list[dict[str, object]]
    evaluation: str
    kyun_messages: list[str] = []
    caution_messages: list[str] = []
    timeline: list[TimelinePoint] = []
    theme_evaluations: dict[str, str] = {}


class RagChunkRequest(BaseModel):
    user_name: str = Field(min_length=1, max_length=100)
    other_name: str = Field(min_length=1, max_length=100)
    talk_history: str = Field(min_length=1, max_length=TALK_HISTORY_MAX_LENGTH)
    max_chunk_chars: int = Field(default=1_200, ge=100, le=12_000)
    overlap_messages: int = Field(default=2, ge=0, le=20)

    @field_validator("user_name", "other_name")
    @classmethod
    def strip_names(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank.")
        return value

    @model_validator(mode="after")
    def check_names_distinct(self) -> RagChunkRequest:
        if self.user_name == self.other_name:
            raise ValueError("user_name and other_name must be different.")
        return self


class RagChunkItem(BaseModel):
    index: int = Field(ge=0)
    text: str = Field(min_length=1)
    source_message_start: int = Field(ge=0)
    source_message_end: int = Field(ge=0)
    message_count: int = Field(ge=1)
    speakers: list[Literal["USER", "OTHER"]]


class RagChunkResponse(BaseModel):
    chunk_count: int = Field(ge=1)
    chunks: list[RagChunkItem]


def context_entry(group: str, option: str) -> dict[str, float | str]:
    try:
        return CONTEXT_OPTIONS[group][option]
    except KeyError as error:
        raise HTTPException(status_code=422, detail=f"Invalid {group} option: {option}") from error

def separate_speakers(history: str, user_name: str, other_name: str) -> list[SeparatedMessage]:
    parsed = parse_talk_history(history, user_name, other_name)
    return [SeparatedMessage(speaker=m.speaker, text=m.text, kind=m.kind, date=m.date) for m in parsed.messages]


def serialize_rag_chunk(chunk: RagChunk) -> RagChunkItem:
    return RagChunkItem(
        index=chunk.index,
        text=chunk.text,
        source_message_start=chunk.source_message_start,
        source_message_end=chunk.source_message_end,
        message_count=chunk.message_count,
        speakers=list(chunk.speakers),
    )


def fallback_variables(messages: list[SeparatedMessage]) -> dict[str, int]:
    text = "\n".join(m.text for m in messages if m.speaker == "OTHER" and m.kind == "text")
    return {key: min(100, 20 + 20 * sum(text.count(word) for word in words)) for key, words in WORDS.items()}

POSITIVE_VARIABLE_KEYS = ("respect", "interest", "relationship_building")
DANGER_VARIABLE_KEYS = ("casual_sex_seeking", "self_priority", "relationship_ambiguity")

def fallback_evidence(messages: list[SeparatedMessage]) -> tuple[list[str], list[str]]:
    other_texts = [m.text for m in messages if m.speaker == "OTHER" and m.kind == "text"]

    def matching_texts(keys: tuple[str, ...]) -> list[str]:
        words = [word for key in keys for word in WORDS[key]]
        matches = [text for text in other_texts if any(word in text for word in words)]
        return list(dict.fromkeys(matches))[:MAX_EVIDENCE_MESSAGES]

    return matching_texts(POSITIVE_VARIABLE_KEYS), matching_texts(DANGER_VARIABLE_KEYS)

def verify_other_quotes(messages: list[SeparatedMessage], quotes: list[str]) -> list[str]:
    other_texts = [m.text for m in messages if m.speaker == "OTHER" and m.kind == "text"]
    return [quote for quote in quotes if any(quote in text for text in other_texts)]

def bucket_messages_by_date(messages: list[SeparatedMessage]) -> dict[str, list[SeparatedMessage]]:
    buckets: dict[str, list[SeparatedMessage]] = {}
    for m in messages:
        if m.date is not None:
            buckets.setdefault(m.date, []).append(m)
    return buckets

def qualifying_dates(buckets: dict[str, list[SeparatedMessage]]) -> list[str]:
    return [date for date in sorted(buckets) if any(m.speaker == "OTHER" and m.kind == "text" for m in buckets[date])]

LLM_RESPONSE_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        **{key: {"type": "integer", "minimum": 0, "maximum": 100} for key in VARIABLE_LABELS},
        "kyun_messages": {"type": "array", "items": {"type": "string"}},
        "caution_messages": {"type": "array", "items": {"type": "string"}},
        "evaluation": {"type": "string"},
        "timeline": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    **{key: {"type": "integer", "minimum": 0, "maximum": 100} for key in VARIABLE_LABELS},
                },
                "required": ["date", *VARIABLE_LABELS],
                "additionalProperties": False,
            },
        },
    },
    "required": [*VARIABLE_LABELS, "kyun_messages", "caution_messages", "evaluation", "timeline"],
    "additionalProperties": False,
}

def build_llm_prompt(
    messages: list[SeparatedMessage],
    patterns: list[dict[str, object]],
    labels: dict[str, str],
    user_name: str,
    other_name: str,
) -> str:
    def line(m: SeparatedMessage) -> str:
        name = other_name if m.speaker == "OTHER" else user_name if m.speaker == "USER" else m.speaker
        date_prefix = f"[{m.date}]" if m.date else ""
        return f"{date_prefix}[{name}] {m.text}"

    transcript = "\n".join(line(m) for m in messages)
    dates = qualifying_dates(bucket_messages_by_date(messages))
    timeline_instruction = (
        f"- timeline: one entry per date in this exact list, using each date string exactly as written: {json.dumps(dates, ensure_ascii=False)}. "
        f"For each date, score the same six variables using only {other_name}'s messages sent on that date (same 0-100 scale and precision as above), weighing that day's evidence in the context of the whole conversation so the scores rise and fall naturally day to day rather than clustering near the same value."
        if dates
        else "- timeline: return an empty array (no dated messages were found)."
    )
    return f"""You are the analysis engine behind kyunpass. Its mission is to help {user_name} find out whether {other_name}'s feelings are pure (純粋) rather than calculated (打算的), so {user_name} can resolve romantic anxiety early and avoid trouble before it happens. Do not make {user_name} suspicious of or aggressive toward {other_name} for its own sake — the goal is protecting {user_name}, not "winning" the relationship or scoring technique.

Analyze {other_name}'s (the OTHER speaker's) romantic intent toward {user_name} in this LINE conversation. Base the six scores strictly on the content of {other_name}'s own messages — {user_name}'s messages are provided only as context for what {other_name} was responding to, and must never themselves be scored or quoted. Every score and every quote must be traceable to a specific message actually sent by {other_name}. Return JSON only:
- integer 0-100 values for respect, interest, relationship_building, casual_sex_seeking, self_priority, relationship_ambiguity. Do not default to round numbers (multiples of 5 or 10) — weigh the actual evidence and use precise values (e.g. 63, 47, 82) that reflect fine-grained differences in strength of evidence.
- kyun_messages: 1-{MAX_EVIDENCE_MESSAGES} verbatim quotes taken only from {other_name}'s own messages (never {user_name}'s) that are the clearest evidence of respect/interest/relationship_building (empty array if none)
- caution_messages: 1-{MAX_EVIDENCE_MESSAGES} verbatim quotes taken only from {other_name}'s own messages (never {user_name}'s) that are the clearest evidence of casual_sex_seeking/self_priority/relationship_ambiguity (empty array if none)
{timeline_instruction}
- evaluation: a short Japanese evaluation. If casual_sex_seeking, self_priority, or relationship_ambiguity is {DANGER_THRESHOLD} or higher, evaluation MUST clearly and gently warn {user_name} and encourage them to pause and be cautious (引き止める) instead of describing the situation neutrally — protect {user_name}, do not attack {other_name}. Otherwise, describe the positive signs found.
Never use vulgar, graphic, or directly sexual wording anywhere in your response (evaluation text or quoted messages), even when quoting the conversation or describing casual_sex_seeking. Paraphrase or soften such wording instead, e.g. describe it as "身体的な関係を急いでいる" rather than using explicit terms.
Relationship context:
- どのくらいの期間やり取りしているか: {labels["period"]}
- 出会ったきっかけ: {labels["meeting"]}
- 現在の関係性: {labels["relationship"]}
Conversation:
{transcript}
Retrieved similar labeled examples (reference only, for calibration — each "variables" field uses the same 0-100 scale you must output):
{json.dumps(patterns, ensure_ascii=False)}"""

class LLMResult(NamedTuple):
    variables: dict[str, int]
    evaluation: str
    kyun_messages: list[str]
    caution_messages: list[str]
    timeline: dict[str, dict[str, int]]

def infer_with_llm(
    messages: list[SeparatedMessage],
    patterns: list[dict[str, object]],
    labels: dict[str, str],
    user_name: str,
    other_name: str,
) -> LLMResult | None:
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        from openai import OpenAI
        recent_messages = messages[-MAX_LLM_INPUT_MESSAGES:]
        prompt = build_llm_prompt(recent_messages, patterns, labels, user_name, other_name)
        output = (
            OpenAI()
            .responses.create(
                model=os.getenv("OPENAI_MODEL", "gpt-5-mini"),
                input=prompt,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "kyun_analysis",
                        "schema": LLM_RESPONSE_SCHEMA,
                        "strict": True,
                    }
                },
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            .output_text
        )
        data = json.loads(output)
        variables = {key: max(0, min(100, int(data[key]))) for key in VARIABLE_LABELS}
        evaluation = str(data["evaluation"]).strip()
        if not evaluation:
            raise ValueError("LLM returned an empty evaluation.")
        kyun_messages = [str(text) for text in data.get("kyun_messages", [])]
        caution_messages = [str(text) for text in data.get("caution_messages", [])]
        timeline: dict[str, dict[str, int]] = {}
        for entry in data.get("timeline", []):
            if not isinstance(entry, dict) or "date" not in entry:
                continue
            try:
                timeline[str(entry["date"])] = {key: max(0, min(100, int(entry[key]))) for key in VARIABLE_LABELS}
            except (KeyError, TypeError, ValueError):
                continue
        return LLMResult(variables, evaluation, kyun_messages, caution_messages, timeline)
    except Exception:
        logger.exception("LLM analysis failed; falling back to keyword-based scoring.")
        return None

def calculate_f(values: dict[str, int]) -> int:
    x = 3 * values["respect"] + 4 * values["interest"] + 2 * values["relationship_building"] - 5 * values["casual_sex_seeking"] - 3 * values["self_priority"] - values["relationship_ambiguity"]
    return max(0, min(100, (x + 900) // 18))

def build_timeline(
    messages: list[SeparatedMessage],
    g: float,
    llm_timeline: dict[str, dict[str, int]] | None = None,
) -> list[TimelinePoint]:
    buckets = bucket_messages_by_date(messages)
    points = []
    for date in qualifying_dates(buckets):
        bucket = buckets[date]
        values = (llm_timeline or {}).get(date) or fallback_variables(bucket)
        f_score = calculate_f(values)
        points.append(TimelinePoint(date=date, function_score=f_score, kyun_score=int(f_score * g), variables=values, message_count=len(bucket)))
    return points

def fallback_evaluation(score: float, values: dict[str, int]) -> str:
    riskiest = max(DANGER_VARIABLE_KEYS, key=values.get)
    if values[riskiest] >= DANGER_THRESHOLD:
        return f"『{VARIABLE_LABELS[riskiest]}』という気になるサインが見られます。無理に関係を進めず、一度立ち止まって様子を見ることをおすすめします。"
    positive = max(POSITIVE_VARIABLE_KEYS, key=values.get)
    return f"キュン度は{'高め' if score >= 70 else 'これから伸びる' if score >= 45 else '慎重に見極める'}段階です。特に『{VARIABLE_LABELS[positive]}』傾向が見られます。"


def theme_evaluations(values: dict[str, int]) -> dict[str, str]:
    messages = {
        "casual_sex_seeking": (
            "身体的な関係を急ぐサインは強くありません。相手のペースを見ながら、安心できる進め方を選べそうです。",
            "身体的な関係を急ぐサインが少し見られます。無理に合わせず、自分のペースを大切にしましょう。",
            "身体的な関係を急ぐサインが強く見られます。関係を急がず、違和感があれば立ち止まって確認しましょう。",
        ),
        "self_priority": (
            "相手が自分の都合だけを優先するサインは強くありません。お互いの予定や気持ちを尊重できそうです。",
            "相手の都合を優先するサインが少し見られます。あなたの予定や気持ちも同じように大切にしましょう。",
            "相手の都合を優先するサインが強く見られます。無理に合わせず、対等に話し合えるかを見極めましょう。",
        ),
        "relationship_ambiguity": (
            "関係を曖昧にするサインは強くありません。相手の気持ちは比較的わかりやすく表れていそうです。",
            "関係を曖昧にするサインが少し見られます。急いで答えを出さず、言葉と行動を見ていきましょう。",
            "関係を曖昧にするサインが強く見られます。期待だけで進めず、あなたが望む関係を確認しましょう。",
        ),
    }
    return {
        key: messages[key][0 if values[key] < 30 else 1 if values[key] < DANGER_THRESHOLD else 2]
        for key in DANGER_VARIABLE_KEYS
    }

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/context-options")
def context_options() -> dict[str, dict[str, dict[str, float | str]]]:
    return CONTEXT_OPTIONS


@app.post("/rag/chunks", response_model=RagChunkResponse)
def create_rag_chunks(request: RagChunkRequest) -> RagChunkResponse:
    """Convert one LINE history to text chunks suitable for RAG embedding."""
    chunks = chunk_talk_history(
        request.talk_history,
        request.user_name,
        request.other_name,
        max_chunk_chars=request.max_chunk_chars,
        overlap_messages=request.overlap_messages,
    )
    if not chunks:
        raise HTTPException(
            status_code=422,
            detail=(
                "Talk history must contain at least one text message from user_name or other_name."
            ),
        )
    return RagChunkResponse(
        chunk_count=len(chunks),
        chunks=[serialize_rag_chunk(chunk) for chunk in chunks],
    )

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    messages = separate_speakers(request.talk_history, request.user_name, request.other_name)
    if not messages:
        raise HTTPException(status_code=422, detail="Talk history must contain at least one message.")
    if not any(m.speaker == "OTHER" for m in messages):
        raise HTTPException(status_code=422, detail="Talk history must contain at least one message from the other person.")
    if not any(m.speaker == "USER" for m in messages):
        raise HTTPException(status_code=422, detail="talk_history内にuser_nameと一致する発言が見つかりませんでした。表記を確認してください。")
    ratio_check_messages = [m for m in messages if m.kind in ("text", "unparsed")]
    unknown_ratio_check_messages = [m for m in ratio_check_messages if m.speaker == "UNKNOWN"]
    if (
        len(ratio_check_messages) >= MIN_TEXT_MESSAGES_FOR_RATIO_CHECK
        and len(unknown_ratio_check_messages) / len(ratio_check_messages) > UNKNOWN_RATIO_THRESHOLD
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "発言者を十分に判別できませんでした。LINEアプリの「トーク履歴を送信」で"
                "出力したtxtファイルを使い、名前選択画面に表示された候補をそのまま選んでください。"
            ),
        )
    other_text = "\n".join(m.text for m in messages if m.speaker == "OTHER" and m.kind == "text")
    patterns = find_similar_rag_patterns(other_text, top_k=MAX_SIMILAR_PATTERNS)
    period_entry = context_entry("A", request.context.period)
    meeting_entry = context_entry("B", request.context.meeting)
    relationship_entry = context_entry("C", request.context.relationship)
    labels = {
        "period": str(period_entry["label"]),
        "meeting": str(meeting_entry["label"]),
        "relationship": str(relationship_entry["label"]),
    }
    llm_result = infer_with_llm(messages, patterns, labels, request.user_name, request.other_name)
    if llm_result:
        values, llm_evaluation, kyun_messages, caution_messages, llm_timeline = llm_result
        kyun_messages = verify_other_quotes(messages, kyun_messages)
        caution_messages = verify_other_quotes(messages, caution_messages)
    else:
        values, llm_evaluation = fallback_variables(messages), ""
        kyun_messages, caution_messages = fallback_evidence(messages)
        llm_timeline = None
    kyun_messages = [mask_vulgar_words(text) for text in kyun_messages]
    caution_messages = [mask_vulgar_words(text) for text in caution_messages]
    g = float(period_entry["coefficient"]) * float(meeting_entry["coefficient"]) * float(relationship_entry["coefficient"])
    f_score = calculate_f(values)
    k = int(f_score * g)
    timeline = build_timeline(messages, g, llm_timeline)
    evaluation = mask_vulgar_words(llm_evaluation or fallback_evaluation(k, values))
    return AnalyzeResponse(kyun_score=k, function_score=f_score, context_score=round(g, 3), variables=values, variable_labels=VARIABLE_LABELS, separated_messages=messages,
    similar_patterns=patterns, evaluation=evaluation, kyun_messages=kyun_messages, caution_messages=caution_messages, timeline=timeline, theme_evaluations=theme_evaluations(values))

@app.post("/investigate")
async def investigate(file: UploadFile) -> dict[str, object]:
    if not (file.filename or "").lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="txtファイルのみアップロードできます")

    raw_bytes = await file.read()

    try:
        talk_history = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=422, detail="テキストファイルとして読み込めませんでした。文字コードを確認してください。"
        ) from error

    if not talk_history.strip():
        raise HTTPException(status_code=422, detail="ファイルが空です")
    if len(talk_history) > TALK_HISTORY_MAX_LENGTH:
        raise HTTPException(status_code=422, detail="ファイルサイズが大きすぎます")

    body, chat_partner_name = parse_header(talk_history)
    records = split_into_records(body)
    if not records:
        raise HTTPException(status_code=422, detail="トーク履歴の内容を読み取れませんでした")

    candidate_speakers = sorted({record.name for record in records if record.name})
    suggested_other_name, suggested_user_name = suggest_speaker_names(candidate_speakers, chat_partner_name)

    return {
        "status": "received",
        "filename": file.filename or "",
        "talk_history": talk_history,
        "candidate_speakers": candidate_speakers,
        "suggested_user_name": suggested_user_name,
        "suggested_other_name": suggested_other_name,
    }
