import Image from "next/image";

export function Header() {
  return (
    <header className="relative mx-auto h-20 w-full max-w-[430px] shrink-0 overflow-hidden border-b border-solid border-[#00000033] bg-[#FBCFE8]">
      <Image
        src="/header/kyunpass-icon.svg"
        alt=""
        width={40}
        height={40}
        unoptimized
        className="absolute left-[18px] top-5 size-10"
      />

      <span className="absolute left-[75.962px] top-[30.672px] h-[22.849px] w-[113.959px]">
        <Image
          src="/header/kyunpass-logo.svg"
          alt="きゅんぱす"
          width={116}
          height={25}
          unoptimized
          className="absolute -left-px -top-px h-[24.849px] w-[115.959px] max-w-none"
        />
      </span>
    </header>
  );
}
