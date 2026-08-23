"use client";

import { useEffect, useRef, useState } from "react";

type Heart = {
  id: number;
  left: number;
  duration: number;
  size: number;
  emoji: string;
};

const EMOJIS = ["💗", "💖", "💕"] as const;
const SPAWN_INTERVAL_MS = 850;
const MAX_HEARTS_ON_SCREEN = 12;

export function KyunCatchGame() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [score, setScore] = useState(0);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHearts((current) => {
        if (current.length >= MAX_HEARTS_ON_SCREEN) return current;

        nextIdRef.current += 1;
        return [
          ...current,
          {
            id: nextIdRef.current,
            left: 8 + Math.random() * 78,
            duration: 2.4 + Math.random() * 1.6,
            size: 20 + Math.random() * 14,
            emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          },
        ];
      });
    }, SPAWN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const removeHeart = (id: number) => {
    setHearts((current) => current.filter((heart) => heart.id !== id));
  };

  const catchHeart = (id: number) => {
    setScore((current) => current + 1);
    removeHeart(id);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="m-0 text-[13px] font-bold text-[#8A8A8A]">
        きゅんキャッチ <span className="text-[#D4537E]">{score}</span>
      </p>
      <div className="relative h-[200px] w-[220px] overflow-hidden rounded-[14px] bg-gradient-to-b from-[#FFF0F5] to-white">
        {hearts.map((heart) => (
          <button
            key={heart.id}
            type="button"
            aria-label="ハートをキャッチ"
            onClick={() => catchHeart(heart.id)}
            onAnimationEnd={() => removeHeart(heart.id)}
            className="absolute top-0 -translate-x-1/2 cursor-pointer select-none leading-none"
            style={{
              left: `${heart.left}%`,
              fontSize: `${heart.size}px`,
              animation: `kyun-fall ${heart.duration}s linear forwards`,
            }}
          >
            {heart.emoji}
          </button>
        ))}
      </div>
      <p className="m-0 text-[11px] text-[#B0B0B0]">
        落ちてくるハートをタップしてね
      </p>
    </div>
  );
}
