import { createClient } from "@supabase/supabase-js";

// 環境変数は front/.env に設定する（Next.js は front/ 配下の .env* しか読み込まないため）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を front/.env に設定してください",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
