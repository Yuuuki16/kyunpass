import { Wave } from "@/components/Wave/Wave";
import Image from "next/image";

export function Loading() {
  return (
    <main
      className="min-h-[100svh] bg-[#8C8C8C] px-4 pt-8 pb-5 max-[480px]:p-0"
      aria-label="音声ローディング"
    >
      <div className="relative mx-auto flex min-h-[calc(100svh-52px)] w-full max-w-[612px] flex-col overflow-hidden bg-[#FBCFE8] max-[480px]:min-h-[100svh]">
        <header className="z-[2] flex h-[120px] shrink-0 items-center gap-6 border-b border-black/20 px-7 max-[480px]:h-[96px] max-[480px]:gap-4 max-[480px]:px-6">
          <Image
            src="/header/kyunpass-icon.svg"
            alt=""
            width={64}
            height={64}
            unoptimized
            className="size-16 max-[480px]:size-[52px]"
          />
          <Image
            src="/header/kyunpass-logo.svg"
            alt="きゅんぱす"
            width={180}
            height={39}
            unoptimized
            className="h-auto w-[180px] max-[480px]:w-[148px]"
          />
        </header>

        <section
          className="relative grid min-h-[900px] flex-1 place-items-center overflow-hidden bg-[#F5F5F5] max-[480px]:min-h-0"
          aria-label="音声を分析しています"
        >
          <div
            className="pointer-events-none absolute -left-[9px] right-0 top-0 z-0 rotate-180 [&>img]:h-auto [&>img]:w-full"
            aria-hidden="true"
          >
            <Wave />
          </div>

          <div
            className="pointer-events-none absolute -right-[9px] bottom-0 left-0 top-[500px] z-0 flex flex-col [&>img]:h-auto [&>img]:w-full [&>img]:shrink-0"
            aria-hidden="true"
          >
            <Wave />
            <div className="-mt-px min-h-px flex-1 bg-[#FBCFE8]" />
          </div>

          <div
            className="z-[1] flex h-[260px] w-[258px] flex-col items-center justify-center gap-[30px] rounded-[14px] bg-white text-[#8A8A8A] shadow-[0_1px_2px_rgba(0,0,0,0.02)] max-[480px]:h-[230px] max-[480px]:w-[220px]"
            role="status"
            aria-live="polite"
          >
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
            <p className="m-0 text-2xl font-bold">分析中...</p>
          </div>
        </section>
      </div>
    </main>
  );
}
