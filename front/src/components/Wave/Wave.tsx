import Image from "next/image";

export function Wave() {
  return (
    <Image
      src="/wave/kyunpass-wave.svg"
      alt=""
      width={413}
      height={294}
      unoptimized
      className="block h-[294px] w-[413px] max-w-none"
    />
  );
}
