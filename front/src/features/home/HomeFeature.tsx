"use client";

import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";

export function HomeFeature() {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]">
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

          <div className="mt-[18px] flex h-[196px] w-[280px] max-w-[calc(100%_-_70px)] items-center justify-center rounded-[20px] border border-dotted border-[#171717] bg-white">
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
          </div>

          <button
            type="button"
            className="mt-[18px] h-16 w-[260px] max-w-[calc(100%_-_90px)] rounded-lg bg-[#FF99B4] text-[32px] leading-none font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          >
            調査する
          </button>
        </section>

        <p className="mt-[67px] text-center text-[20px] leading-[29px] font-bold text-[#FF99B4]">
          純粋な気持ちを数値化します
        </p>
      </main>
    </div>
  );
}
