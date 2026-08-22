import { createServerSupabaseClient } from "@db/supabase/server";
import { parseShareableResult } from "@/features/result/resultData";

const MAX_REQUEST_LENGTH = 100_000;

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_REQUEST_LENGTH) {
    return Response.json(
      { error: "共有する結果データが大きすぎます" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const result = parseShareableResult(body);
  if (!result) {
    return Response.json({ error: "結果データが不正です" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("shared_results")
    .insert({ payload: result })
    .select("id")
    .single();

  if (error || typeof data?.id !== "string") {
    return Response.json(
      { error: "共有リンクを作成できませんでした" },
      { status: 500 },
    );
  }

  return Response.json({ shareId: data.id }, { status: 201 });
}
