import os

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

# .env 読み込み
load_dotenv()

# OpenAIクライアント
openai_client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)

# Supabaseクライアント
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# -----------------------------
# 1. SupabaseからRAGパターン取得
# -----------------------------
response = (
    supabase
    .table("rag_patterns")
    .select("id, conversation_example")
    .execute()
)

patterns = response.data or []

print("取得件数:", len(patterns))
print("取得データ:", patterns)

# 0件ならここで止める
if not patterns:
    raise RuntimeError(
        "Supabaseからrag_patternsを取得できませんでした。"
        "テーブル名・RLS・SUPABASE_KEYを確認してください。"
    )

# -----------------------------
# 2. Embedding対象の文章を作る
# -----------------------------
valid_patterns = [
    pattern
    for pattern in patterns
    if pattern.get("conversation_example")
]

texts = [
    pattern["conversation_example"]
    for pattern in valid_patterns
]

print("Embedding対象件数:", len(texts))
print("Embeddingする文章:", texts)

# conversation_example が全部空なら止める
if not texts:
    raise RuntimeError(
        "conversation_exampleが1件も取得できませんでした。"
        "Supabaseの列名やデータ内容を確認してください。"
    )

# -----------------------------
# 3. OpenAI Embedding API
# -----------------------------
embedding_response = openai_client.embeddings.create(
    model="text-embedding-3-small",
    input=texts,
)

print(
    "生成されたEmbedding件数:",
    len(embedding_response.data)
)

# -----------------------------
# 4. SupabaseへEmbedding保存
# -----------------------------
for pattern, embedding_data in zip(
    valid_patterns,
    embedding_response.data
):
    vector = embedding_data.embedding

    (
        supabase
        .table("rag_patterns")
        .update({
            "embedding": vector
        })
        .eq("id", pattern["id"])
        .execute()
    )

    print(
        f"id={pattern['id']} のEmbeddingを保存しました"
    )

print(
    f"{len(valid_patterns)}件のEmbedding登録が完了しました"
)