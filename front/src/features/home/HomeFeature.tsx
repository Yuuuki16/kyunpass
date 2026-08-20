"use client";

import { Header } from "@/components/header/Header";

// import { useState } from "react";
// import { ScoreBadge } from "@/components/ScoreBadge";

export function HomeFeature() {
  // const [score] = useState(0);

  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">kyunpass</h1>
        {/* <ScoreBadge score={score} /> */}
      </main>
    </>
  );
}
