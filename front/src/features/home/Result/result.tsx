import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import { Zen_Maru_Gothic } from "next/font/google";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export function Result() {
  return (
    <div
      className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
    >
      <Header />

      <div
        className="pointer-events-none absolute -right-[9px] bottom-0 left-0 top-[580px] flex flex-col [&>img]:h-auto [&>img]:w-full [&>img]:shrink-0"
        aria-hidden="true"
      >
        <Wave />
        <div className="-mt-px min-h-px flex-1 bg-[#FBCFE8]" />
      </div>

      <main className="relative z-10 flex flex-col items-center pb-[61px] pt-[42px]">
        <section className="flex h-[560px] w-[calc(100%_-_52px)] max-w-[300px] flex-col items-center rounded-lg bg-white">
          <h1 className="flex h-[60px] w-full shrink-0 items-center justify-center rounded-lg bg-[#D4537E] text-[32px] leading-none font-bold text-white">
            分析結果
          </h1>

          <h2 className="mt-[15px] text-[20px] leading-[29px] font-bold text-[#FBCFE8]">
            きゅん度
          </h2>

          <div className="mt-[10px] flex h-[150px] w-[220px] max-w-[calc(100%_-_48px)] shrink-0 items-center justify-center rounded-[20px] bg-[#FBCFE8] text-[20px] leading-[29px] text-white">
            50%
          </div>

          <h2 className="mt-6 text-[20px] leading-[29px] font-bold text-[#FBCFE8]">
            判定理由
          </h2>

          <div className="mt-2 flex h-[150px] w-[220px] max-w-[calc(100%_-_48px)] shrink-0 items-center rounded-[20px] bg-[#FBCFE8] px-[10px] text-[12px] leading-[17px] text-white">
            test
          </div>

          <button
            type="button"
            className="mt-[22px] h-12 w-[140px] rounded-lg bg-[#FAE1FA] text-[24px] leading-none font-bold text-[#FF99B4] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          >
            共有
          </button>
        </section>

        <button
          type="button"
          className="mt-[83px] h-12 w-[140px] rounded-lg bg-[#FF99B4] text-[20px] leading-none text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        >
          新しく調査
        </button>
      </main>
    </div>
  );
}
