import os

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

openai_client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# ------------------------------
# テスト用LINE会話
# ------------------------------

conversation = """
[USER] 今日楽しかったな
[OTHER] 私も楽しかった！
[USER] また行こうや
[OTHER] うん、今度は前に言ってた店行きたい
""".strip()

# ------------------------------
# 1. 会話をEmbedding
# ------------------------------

embedding_response = openai_client.embeddings.create(
    model="text-embedding-3-small",
    input=conversation,
)

query_embedding = embedding_response.data[0].embedding

print("Embedding生成完了")

# ------------------------------
# 2. SupabaseでTop5検索
# ------------------------------

response = supabase.rpc(
    "match_rag_patterns",
    {
        "query_embedding": query_embedding,
        "match_count": 5,
    }
).execute()

patterns = response.data

# ------------------------------
# 3. 結果表示
# ------------------------------

print("\n=== RAG検索結果 ===")

for index, pattern in enumerate(patterns, start=1):
    print(f"\n{index}位")
    print("pattern_name:", pattern["pattern_name"])
    print("conversation_example:", pattern["conversation_example"])
    print("similarity:", round(pattern["similarity"], 3))
    print(
        "a-f:",
        pattern["a"],
        pattern["b"],
        pattern["c"],
        pattern["d"],
        pattern["e"],
        pattern["f"],
    )