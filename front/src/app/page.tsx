"use client";

import { useEffect, useState } from "react";
import { HomeFeature } from "@/features/home/home";
import { Title } from "@/features/home/title/Title";

const SPLASH_DURATION_MS = 2000;

export default function Page() {
  const [showTitle, setShowTitle] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTitle(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-dvh w-full">
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          showTitle ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Title />
      </div>
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          showTitle ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <HomeFeature />
      </div>
    </div>
  );
}
