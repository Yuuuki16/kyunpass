"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zen_Maru_Gothic } from "next/font/google";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const HEART_PATH =
  "M100 168C84 150 20 104 20 58C20 27 42 10 69 10C85 10 96 19 100 31C104 19 115 10 131 10C158 10 180 27 180 58C180 104 116 150 100 168Z";
const METER_LEVELS = [22, 68, 36, 84, 48, 76, 42, 90];

function readPreresultData() {
  if (typeof window === "undefined") {
    return { otherName: "", kyunScore: null as number | null };
  }

  const otherName = sessionStorage.getItem("kyunpass:otherName") ?? "";
  const storedScore = sessionStorage.getItem("kyunpass:kyunScore");
  const parsedScore = storedScore !== null ? Number(storedScore) : NaN;

  return {
    otherName,
    kyunScore: Number.isFinite(parsedScore)
      ? Math.min(100, Math.max(0, parsedScore))
      : null,
  };
}

export function Preresult() {
  const router = useRouter();
  const [{ otherName, kyunScore }] = useState(readPreresultData);
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [isMeterVisible, setIsMeterVisible] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (kyunScore === null || otherName === "") {
      router.replace("/");
      return;
    }

    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timers.push(window.setTimeout(callback, delay));
    };
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    schedule(() => setIsIntroVisible(true), 100);

    if (prefersReducedMotion) {
      schedule(() => setIsMeterVisible(true), 200);
      schedule(() => {
        setMeterLevel(kyunScore);
        setIsRevealed(true);
      }, 600);
    } else {
      schedule(() => setIsMeterVisible(true), 1200);
      METER_LEVELS.forEach((level, index) => {
        schedule(() => setMeterLevel(level), 1500 + index * 400);
      });
      schedule(() => {
        setMeterLevel(kyunScore);
        setIsRevealed(true);
      }, 5000);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [kyunScore, otherName, router]);

  if (kyunScore === null || otherName === "") {
    return null;
  }

  return (
    <div
      className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-[#F5F5F5]`}
    >
      <Header />

      <div
        className="pointer-events-none absolute -right-[9px] bottom-0 left-0 [&>img]:h-auto [&>img]:w-full"
        aria-hidden="true"
      >
        <Wave />
      </div>

      <main className="relative z-10 flex min-h-[calc(100dvh-80px)] flex-col items-center px-6 pt-12 pb-10 text-center">
        <p
          className={`min-h-[70px] max-w-[340px] text-[22px] leading-9 font-bold text-[#D4537E] transition-all duration-700 motion-reduce:transition-none ${
            isIntroVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-5 opacity-0"
          }`}
        >
          {otherName}からあなたへの
          <br />
          キュン度は・・・
        </p>

        <div
          className={`relative mt-8 size-[220px] transition-all duration-700 ease-out motion-reduce:transition-none ${
            isMeterVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-8 opacity-0"
          }`}
          role="img"
          aria-label={isRevealed ? `キュン度${kyunScore}%` : "キュン度を測定中"}
        >
          <svg viewBox="0 0 200 180" className="size-full" aria-hidden="true">
            <defs>
              <clipPath id="preresult-heart-clip">
                <path d={HEART_PATH} />
              </clipPath>
            </defs>
            <path d={HEART_PATH} fill="#FBCFE8" fillOpacity="0.55" />
            <g clipPath="url(#preresult-heart-clip)">
              <rect
                x="0"
                y="0"
                width="200"
                height="180"
                fill="#EF4444"
                style={{
                  transform: `translateY(${100 - meterLevel}%)`,
                  transformBox: "fill-box",
                  transition: "transform 450ms linear",
                }}
              />
            </g>
            <path
              d={HEART_PATH}
              fill="none"
              stroke="#D4537E"
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>

          <p
            className={`pointer-events-none absolute inset-0 flex items-center justify-center pt-3 text-[48px] leading-none font-bold text-white transition-opacity duration-300 motion-reduce:transition-none ${
              isRevealed ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            {isRevealed ? `${kyunScore}%` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/result")}
          disabled={!isRevealed}
          className={`mt-auto h-12 w-[160px] rounded-lg bg-[#FF99B4] text-[20px] leading-none font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] transition-all duration-500 motion-reduce:transition-none ${
            isRevealed
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          詳細結果へ
        </button>
      </main>
    </div>
  );
}
