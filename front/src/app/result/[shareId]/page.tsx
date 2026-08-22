import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@db/supabase/server";
import { Result } from "@/features/result/result";
import { parseShareableResult } from "@/features/result/resultData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  if (!UUID_PATTERN.test(shareId)) notFound();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("shared_results")
    .select("payload")
    .eq("id", shareId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error("共有結果を取得できませんでした", { cause: error });
  }

  const result = parseShareableResult(data?.payload);
  if (!result) notFound();

  return <Result initialResult={result} />;
}
