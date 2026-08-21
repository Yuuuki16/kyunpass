import Image from "next/image";

export function Title() {
  return (
    <main
      aria-label="kyunpass タイトル画面"
      className="mx-auto flex min-h-screen w-full max-w-[402px] flex-1 items-center justify-center bg-[#FF99B4]"
    >
      <Image
        src="/header/Frame.svg"
        alt=""
        width={101}
        height={102}
        unoptimized
      />
    </main>
  );
}
