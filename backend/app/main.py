"""Kyun score API."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from app.line_parser import parse as parse_talk_history
from app.line_parser import split_into_records, strip_export_header

app = FastAPI(title="kyunpass API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

UNKNOWN_RATIO_THRESHOLD = 0.5
MIN_TEXT_MESSAGES_FOR_RATIO_CHECK = 5
TALK_HISTORY_MAX_LENGTH = 2_000_000

CONTEXT_OPTIONS: dict[str, dict[str, dict[str, float | str]]] = {
    "A": {"A1": {"label": "1週間未満", "coefficient": 0.8}, "A2": {"label": "1週間〜1か月", "coefficient": 0.85}, "A3": {"label": "1〜3か月", "coefficient": 0.9}, "A4": {"label": "3か月〜1年", "coefficient": 0.95}, "A5": {"label": "1年以上", "coefficient": 1.0}},
    "B": {"B1": {"label": "友人・知人の紹介", "coefficient": 1.0}, "B2": {"label": "学校・大学・サークル", "coefficient": 0.8}, "B3": {"label": "バイト・職場", "coefficient": 0.8}, "B4": {"label": "SNS・オンライン", "coefficient": 0.8}, "B5": {"label": "趣味・イベント", "coefficient": 0.9}, "B6": {"label": "偶然", "coefficient": 0.9}},
    "C": {"C1": {"label": "ほとんど面識がない", "coefficient": 0.8}, "C2": {"label": "知り合い", "coefficient": 0.85}, "C3": {"label": "友人", "coefficient": 0.9}, "C4": {"label": "恋人", "coefficient": 1.0}},
}
VARIABLE_LABELS = {"respect": "相手を尊重している", "interest": "相手に関心を持っている", "relationship_building": "継続的な関係性を築こうとしている", "casual_sex_seeking": "カジュアルセックスを探索している", "self_priority": "自分を優先している", "relationship_ambiguity": "恋愛関係を曖昧にしている"}
WORDS = {"respect": ("ありがとう", "ごめん", "無理しないで", "大丈夫"), "interest": ("好き", "趣味", "仕事", "体調", "元気"), "relationship_building": ("また", "今度", "会おう", "一緒に", "予定"), "casual_sex_seeking": ("ホテル", "泊ま", "セフレ", "エッチ", "体の関係"), "self_priority": ("俺の都合", "私の都合", "今すぐ", "してよ"), "relationship_ambiguity": ("友達のまま", "曖昧", "付き合えない", "まだ決められない")}

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

class AnalyzeResponse(BaseModel):

    kyun_score: int = Field(ge=0, le=100)
    function_score: int = Field(ge=0, le=100)
    context_score: float = Field(gt=0, le=1)
    variables: dict[str, int]
    variable_labels: dict[str, str]
    separated_messages: list[SeparatedMessage]
    similar_patterns: list[dict[str, object]]
    evaluation: str

def coefficient(group: str, option: str) -> float:
    try:
        return float(CONTEXT_OPTIONS[group][option]["coefficient"])
    except KeyError as error:
        raise HTTPException(status_code=422, detail=f"Invalid {group} option: {option}") from error

def separate_speakers(history: str, user_name: str, other_name: str) -> list[SeparatedMessage]:
    parsed = parse_talk_history(history, user_name, other_name)
    return [SeparatedMessage(speaker=m.speaker, text=m.text, kind=m.kind) for m in parsed.messages]

def load_patterns() -> list[dict[str, object]]:
    path = Path(__file__).resolve().parents[2] / "db" / "patterns.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def fallback_variables(messages: list[SeparatedMessage]) -> dict[str, int]:
    text = "\n".join(m.text for m in messages if m.speaker == "OTHER" and m.kind == "text")
    return {key: min(100, 20 + 20 * sum(text.count(word) for word in words)) for key, words in WORDS.items()}

def infer_with_llm(messages: list[SeparatedMessage], patterns: list[dict[str, object]]) -> tuple[dict[str, int], str] | None:
    return None  # LLM呼び出しを一時停止中。常にフォールバック(モック)を使う。
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        from openai import OpenAI
        transcript = "\n".join(f"[{m.speaker}] {m.text}" for m in messages)
        prompt = f"""Analyze the OTHER speaker's romantic intent in this LINE conversation. Return JSON only: integer 0-100 values for respect, interest, relationship_building, casual_sex_seeking, self_priority, relationship_ambiguity; plus a short Japanese evaluation. Retrieved similar patterns are reference only.\nConversation:\n{transcript}\nPatterns:\n{json.dumps(patterns, ensure_ascii=False)}"""
        output = OpenAI().responses.create(model=os.getenv("OPENAI_MODEL", "gpt-5-mini"), input=prompt).output_text
        data = json.loads(output)
        variables = {key: max(0, min(100, int(data[key]))) for key in VARIABLE_LABELS}
        return variables, str(data["evaluation"]).strip()
    except Exception:
        return None

def calculate_f(values: dict[str, int]) -> int:
    x = 3 * values["respect"] + 4 * values["interest"] + 2 * values["relationship_building"] - 5 * values["casual_sex_seeking"] - 3 * values["self_priority"] - values["relationship_ambiguity"]
    return max(0, min(100, (x + 900) // 18))

def fallback_evaluation(score: float, values: dict[str, int]) -> str:
    positive = max(("respect", "interest", "relationship_building"), key=values.get)
    return f"キュン度は{'高め' if score >= 70 else 'これから伸びる' if score >= 45 else '慎重に見極める'}段階です。特に『{VARIABLE_LABELS[positive]}』傾向が見られます。"

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/context-options")
def context_options() -> dict[str, dict[str, dict[str, float | str]]]:
    return CONTEXT_OPTIONS

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
            detail="発言者名がトーク履歴内の表記と一致しない行が多数あります。user_name/other_nameを確認してください。",
        )
    patterns = load_patterns()
    llm_result = infer_with_llm(messages, patterns)
    values, llm_evaluation = llm_result or (fallback_variables(messages), "")
    g = coefficient("A", request.context.period) * coefficient("B", request.context.meeting) * coefficient("C", request.context.relationship)
    f_score = calculate_f(values)
    k = int(f_score * g)
    return AnalyzeResponse(kyun_score=k, function_score=f_score, context_score=round(g, 3), variables=values, variable_labels=VARIABLE_LABELS, separated_messages=messages,
  similar_patterns=patterns, evaluation=llm_evaluation or fallback_evaluation(k, values))

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

    records = split_into_records(strip_export_header(talk_history))
    if not records:
        raise HTTPException(status_code=422, detail="トーク履歴の内容を読み取れませんでした")

    candidate_speakers = sorted({record.name for record in records if record.name})

    return {
        "status": "received",
        "filename": file.filename or "",
        "talk_history": talk_history,
        "candidate_speakers": candidate_speakers,
    }
