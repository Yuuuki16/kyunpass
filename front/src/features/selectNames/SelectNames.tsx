"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import { Zen_Maru_Gothic } from "next/font/google";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

function readInvestigationResult() {
  if (typeof window === "undefined") {
    return {
      candidates: [] as string[],
      suggestedUserName: "",
      suggestedOtherName: "",
    };
  }

  const storedCandidates = sessionStorage.getItem("kyunpass:candidateSpeakers");
  let candidates: string[] = [];
  try {
    const parsed = storedCandidates ? JSON.parse(storedCandidates) : [];
    candidates = Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    candidates = [];
  }

  const suggestedUserName =
    sessionStorage.getItem("kyunpass:suggestedUserName") ?? "";
  const suggestedOtherName =
    sessionStorage.getItem("kyunpass:suggestedOtherName") ?? "";

  return {
    candidates,
    suggestedUserName: candidates.includes(suggestedUserName)
      ? suggestedUserName
      : "",
    suggestedOtherName: candidates.includes(suggestedOtherName)
      ? suggestedOtherName
      : "",
  };
}

export function SelectNames() {
  const router = useRouter();
  const [{ candidates, suggestedUserName, suggestedOtherName }] = useState(
    readInvestigationResult,
  );
  const [userName, setUserName] = useState(suggestedUserName);
  const [otherName, setOtherName] = useState(suggestedOtherName);

  useEffect(() => {
    if (candidates.length === 0) {
      router.replace("/");
    }
  }, [candidates, router]);

  const handleUserNameChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setUserName(event.target.value);
  };

  const handleOtherNameChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setOtherName(event.target.value);
  };

  const canSubmit =
    userName !== "" && otherName !== "" && userName !== otherName;

  const handleSubmit = () => {
    if (!canSubmit) return;

    sessionStorage.setItem("kyunpass:userName", userName);
    sessionStorage.setItem("kyunpass:otherName", otherName);
    router.push("/chatbot");
  };

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div
      className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
    >
      <Header />

      <div
        className="pointer-events-none absolute -left-[9px] right-0 top-20 rotate-180 [&>img]:h-auto [&>img]:w-full"
        aria-hidden="true"
      >
        <Wave />
      </div>

      <main className="relative z-10 flex flex-col items-center pt-10">
        <section className="w-[calc(100%_-_52px)] max-w-[300px] rounded-lg bg-white">
          <h1 className="flex h-[60px] items-center justify-center rounded-lg bg-[#D4537E] text-[24px] leading-none font-bold text-white">
            名前の確認
          </h1>

          <div className="flex flex-col gap-5 px-5 py-6">
            <p className="text-[12px] leading-[17px] text-[#4B4B4B]">
              トーク履歴から話者を検出しました。あなたと相手の名前をそれぞれ選んでください。
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[14px] font-bold text-[#D4537E]">
                自分の名前
              </span>
              <select
                value={userName}
                onChange={handleUserNameChange}
                className="h-11 rounded-lg border border-[#FF99B4] bg-white px-3 text-[14px] text-[#4B4B4B]"
              >
                <option value="">選択してください</option>
                {candidates.map((name) => (
                  <option key={name} value={name} disabled={name === otherName}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[14px] font-bold text-[#D4537E]">
                相手の名前
              </span>
              <select
                value={otherName}
                onChange={handleOtherNameChange}
                className="h-11 rounded-lg border border-[#FF99B4] bg-white px-3 text-[14px] text-[#4B4B4B]"
              >
                <option value="">選択してください</option>
                {candidates.map((name) => (
                  <option key={name} value={name} disabled={name === userName}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="mt-2 h-12 w-full rounded-lg bg-[#FF99B4] text-[18px] font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
