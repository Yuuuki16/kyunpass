import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import { Zen_Maru_Gothic } from "next/font/google";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

export function Chatbot() {
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

      <main className="relative z-10 flex justify-center pt-10">
        <section className="h-[500px] w-[calc(100%_-_52px)] max-w-[300px] rounded-lg bg-white">
          <h1 className="flex h-[60px] items-center justify-center rounded-lg bg-[#D4537E] text-[32px] leading-none font-bold text-white">
            背景調査
          </h1>
        </section>
      </main>
    </div>
  );
}
