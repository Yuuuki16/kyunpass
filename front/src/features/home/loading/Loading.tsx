import Image from "next/image";

export function Loading() {
  return (
    <main className="loading-screen" aria-label="音声ローディング">
      <div className="loading-frame">
        <header className="loading-header">
          <Image
            src="/header/kyunpass-icon.svg"
            alt=""
            width={64}
            height={64}
            unoptimized
            className="loading-icon"
          />
          <Image
            src="/header/kyunpass-logo.svg"
            alt="きゅんぱす"
            width={180}
            height={39}
            unoptimized
            className="loading-logo"
          />
        </header>

        <section className="loading-body" aria-label="音声を分析しています">
          <div className="loading-wave loading-wave-top" aria-hidden="true" />
          <div
            className="loading-wave loading-wave-bottom"
            aria-hidden="true"
          />
          <div className="loading-card" role="status" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  style={{ transform: `rotate(${index * 45}deg)` }}
                />
              ))}
            </div>
            <p>分析中...</p>
          </div>
        </section>
      </div>
    </main>
  );
}
