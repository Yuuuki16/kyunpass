"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zen_Maru_Gothic } from "next/font/google";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

type LoadingProps = {
  isComplete: boolean;
};

// The real work happens in one blocking backend call with no progress
// events, so this bar is a perceived-progress simulation, not real
// completion percentage: it eases toward a cap and never reaches it on
// its own, then snaps to 100% once isComplete flips to true.
const STATUS_MESSAGES = [
  "トーク履歴を読み込んでいます",
  "言葉の端々からサインを探しています",
  "純粋な気持ちを見極めています",
  "もうすぐ結果が出ます",
] as const;
const PROGRESS_CAP_WHILE_ANALYZING = 92;
const PROGRESS_TIME_CONSTANT_MS = 9000;
const PROGRESS_TICK_MS = 200;
const MESSAGE_ROTATE_MS = 3200;

export function Loading({ isComplete }: LoadingProps) {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => {
      setMessageIndex((index) => (index + 1) % STATUS_MESSAGES.length);
    }, MESSAGE_ROTATE_MS);
    return () => clearInterval(id);
  }, [isComplete]);

  useEffect(() => {
    if (isComplete) return;
    startTimeRef.current ??= Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current as number);
      setProgress(
        PROGRESS_CAP_WHILE_ANALYZING *
          (1 - Math.exp(-elapsed / PROGRESS_TIME_CONSTANT_MS)),
      );
    }, PROGRESS_TICK_MS);
    return () => clearInterval(id);
  }, [isComplete]);

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

      <div
        className="pointer-events-none absolute -right-[9px] bottom-0 left-0 top-[580px] flex flex-col [&>img]:h-auto [&>img]:w-full [&>img]:shrink-0"
        aria-hidden="true"
      >
        <Wave />
        <div className="-mt-px min-h-px flex-1 bg-[#FBCFE8]" />
      </div>

      <main className="relative z-10 grid min-h-[calc(100dvh-80px)] place-items-center px-6 py-10">
        <section
          className="flex h-[230px] w-[220px] flex-col items-center justify-center gap-[30px] rounded-[14px] bg-white text-[#8A8A8A] shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          role="status"
          aria-live="polite"
          aria-label={isComplete ? "分析が完了しました" : "分析しています"}
        >
          {isComplete ? (
            <>
              <p className="m-0 text-[28px] leading-10 font-bold text-[#D4537E]">
                分析完了！
              </p>
              <button
                type="button"
                onClick={() => router.push("/preresult")}
                className="h-12 w-[140px] rounded-lg bg-[#FF99B4] text-[20px] leading-none font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
              >
                結果発表
              </button>
            </>
          ) : (
            <>
              <div
                className="relative size-[84px] animate-[loading-spin_1.4s_linear_infinite] motion-reduce:animate-[loading-spin_3s_linear_infinite]"
                aria-hidden="true"
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <span
                    key={index}
                    className="absolute top-0 left-[39px] h-[26px] w-[6px] origin-[3px_42px] rounded-full bg-[#D4537E]"
                    style={{ transform: `rotate(${index * 45}deg)` }}
                  />
                ))}
              </div>
              <div className="flex w-[170px] flex-col items-center gap-2.5">
                <p
                  className="m-0 min-h-[40px] text-center text-[15px] leading-5 font-bold"
                  aria-live="polite"
                >
                  {STATUS_MESSAGES[messageIndex]}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDEDED]">
                  <div
                    className="h-full rounded-full bg-[#D4537E] transition-[width] duration-200 ease-out motion-reduce:transition-none"
                    style={{ width: `${isComplete ? 100 : progress}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
