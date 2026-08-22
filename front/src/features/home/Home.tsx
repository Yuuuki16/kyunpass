"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";

const mPlusRounded1c = M_PLUS_Rounded_1c({
  weight: ["400", "700"],
  subsets: ["latin"],
});

type SubmitStatus = "idle" | "submitting" | "error";

export function HomeFeature() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>(
    "送信に失敗しました。もう一度お試しください。",
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setStatus("idle");
  };

  const handleSubmit = async () => {
    if (!file) return;

    setStatus("submitting");
    router.push("/loading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/investigate`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "送信に失敗しました",
        );
      }

      if (typeof data.talk_history === "string") {
        sessionStorage.setItem("kyunpass:talkHistory", data.talk_history);
      }
      if (Array.isArray(data.candidate_speakers)) {
        sessionStorage.setItem(
          "kyunpass:candidateSpeakers",
          JSON.stringify(data.candidate_speakers),
        );
      }
      sessionStorage.setItem(
        "kyunpass:suggestedUserName",
        typeof data.suggested_user_name === "string"
          ? data.suggested_user_name
          : "",
      );
      sessionStorage.setItem(
        "kyunpass:suggestedOtherName",
        typeof data.suggested_other_name === "string"
          ? data.suggested_other_name
          : "",
      );

      setStatus("idle");
      router.push("/select-names");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "送信に失敗しました。もう一度お試しください。",
      );
      setStatus("error");
      router.push("/");
    }
  };

  return (
    <div
      className={`${mPlusRounded1c.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
    >
      <Header />

      <div
        className="pointer-events-none absolute -left-[9px] right-0 top-20 rotate-180 [&>img]:h-auto [&>img]:w-full"
        aria-hidden="true"
      >
        <Wave />
      </div>

      <main className="relative z-10 flex flex-col items-center pt-[178px]">
        <section className="flex h-[377px] w-[calc(100%_-_52px)] max-w-[350px] flex-col items-center rounded-lg bg-white pt-[29px]">
          <p className="text-center text-[12px] leading-[17px] text-[#4B4B4B]">
            調査したいテキストをアップロードしてください
          </p>

          <label
            htmlFor="text-file-upload"
            className="mt-[18px] flex h-[196px] w-[280px] max-w-[calc(100%_-_70px)] cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dotted border-[#171717] bg-white"
          >
            <input
              id="text-file-upload"
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 56 56"
              fill="none"
              className="size-14 text-[#FF99B4]"
            >
              <path
                d="M28 7V36M16 24L28 36L40 24"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 38V46C11 47.657 12.343 49 14 49H42C43.657 49 45 47.657 45 46V38"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {file && (
              <p className="mt-2 max-w-[calc(100%_-_32px)] truncate px-2 text-center text-[12px] leading-[17px] text-[#4B4B4B]">
                {file.name}
              </p>
            )}
          </label>

          <button
            type="button"
            disabled={!file || status === "submitting"}
            onClick={handleSubmit}
            className="mt-[18px] h-16 w-[260px] max-w-[calc(100%_-_90px)] rounded-lg bg-[#FF99B4] text-[32px] leading-none font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            調査する
          </button>

          {status === "error" && (
            <p className="mt-2 text-center text-[12px] leading-[17px] text-red-500">
              {errorMessage}
            </p>
          )}
        </section>

        <p className="mt-[67px] text-center text-[20px] leading-[29px] font-bold text-[#FF99B4]">
          純粋な気持ちを数値化します
        </p>
      </main>
    </div>
  );
}
