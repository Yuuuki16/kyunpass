"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import { Zen_Maru_Gothic } from "next/font/google";
import { useRouter } from "next/navigation";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

type TimelinePoint = {
  date: string;
  kyun_score: number;
};

function parseTimeline(raw: string | null): TimelinePoint[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (point): point is TimelinePoint =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as Record<string, unknown>).date === "string" &&
        typeof (point as Record<string, unknown>).kyun_score === "number",
    );
  } catch {
    return [];
  }
}

type AnalyzeResult = {
  kyunScore: number | null;
  evaluation: string;
  timeline: TimelinePoint[];
  kyunMessages: string[];
  cautionMessages: string[];
  variables: Record<string, number>;
  themeEvaluations: Record<string, string>;
};

const SERVER_SNAPSHOT: AnalyzeResult = {
  kyunScore: null,
  evaluation: "",
  timeline: [],
  kyunMessages: [],
  cautionMessages: [],
  variables: {},
  themeEvaluations: {},
};

function parseMessages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseVariables(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value),
      ),
    );
  } catch {
    return {};
  }
}

function parseEvaluations(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string"),
    );
  } catch {
    return {};
  }
}

let cachedRaw: string | null = null;
let cachedResult: AnalyzeResult = SERVER_SNAPSHOT;

function getSnapshot(): AnalyzeResult {
  const raw = [
    sessionStorage.getItem("kyunpass:kyunScore"),
    sessionStorage.getItem("kyunpass:evaluation"),
    sessionStorage.getItem("kyunpass:timeline"),
    sessionStorage.getItem("kyunpass:kyunMessages"),
    sessionStorage.getItem("kyunpass:cautionMessages"),
    sessionStorage.getItem("kyunpass:variables"),
    sessionStorage.getItem("kyunpass:themeEvaluations"),
  ].join(" ");

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    const storedScore = sessionStorage.getItem("kyunpass:kyunScore");
    const parsedScore = storedScore !== null ? Number(storedScore) : NaN;
    cachedResult = {
      kyunScore: Number.isFinite(parsedScore) ? parsedScore : null,
      evaluation: sessionStorage.getItem("kyunpass:evaluation") ?? "",
      timeline: parseTimeline(sessionStorage.getItem("kyunpass:timeline")),
      kyunMessages: parseMessages(
        sessionStorage.getItem("kyunpass:kyunMessages"),
      ),
      cautionMessages: parseMessages(
        sessionStorage.getItem("kyunpass:cautionMessages"),
      ),
      variables: parseVariables(sessionStorage.getItem("kyunpass:variables")),
      themeEvaluations: parseEvaluations(
        sessionStorage.getItem("kyunpass:themeEvaluations"),
      ),
    };
  }

  return cachedResult;
}

function getServerSnapshot(): AnalyzeResult {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function smoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length < 3) {
    return coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
      .join(" ");
  }
  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function describeTrend(points: TimelinePoint[]): {
  arrow: string;
  label: string;
  className: string;
} {
  const delta = points[points.length - 1].kyun_score - points[0].kyun_score;
  if (delta > 0) {
    return { arrow: "↑", label: `+${delta}pt`, className: "text-[#D4537E]" };
  }
  if (delta < 0) {
    return { arrow: "↓", label: `${delta}pt`, className: "text-[#9CA3AF]" };
  }
  return { arrow: "→", label: "横ばい", className: "text-[#B8B8B8]" };
}

function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const width = 220;
  const height = 110;
  const showAllLabels = points.length <= 6;
  const marginLeft = 20;
  const marginRight = 6;
  const marginTop = 16;
  const marginBottom = showAllLabels ? 14 : 4;
  const plotHeight = height - marginTop - marginBottom;
  const xStep =
    points.length > 1
      ? (width - marginLeft - marginRight) / (points.length - 1)
      : 0;
  const toY = (score: number) =>
    marginTop + plotHeight - (score / 100) * plotHeight;

  const coords = points.map((point, index) => ({
    x: marginLeft + index * xStep,
    y: toY(point.kyun_score),
  }));
  const linePath = smoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${marginTop + plotHeight} L ${coords[0].x} ${marginTop + plotHeight} Z`;
  const lastIndex = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="きゅん度の推移"
    >
      <defs>
        <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBCFE8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FBCFE8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 50, 100].map((value) => (
        <g key={value}>
          <line
            x1={marginLeft}
            x2={width - marginRight}
            y1={toY(value)}
            y2={toY(value)}
            stroke="#EFEFEF"
            strokeWidth={1}
          />
          <text x={0} y={toY(value) + 3} fontSize={8} fill="#C9C9C9">
            {value}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#timelineFill)" stroke="none" />
      <path d={linePath} fill="none" stroke="#D4537E" strokeWidth={2} />

      {coords.map((coord, index) => {
        const isLast = index === lastIndex;
        return (
          <g key={points[index].date}>
            {isLast && (
              <>
                <circle cx={coord.x} cy={coord.y} r={4.5} fill="#D4537E" />
                <text
                  x={coord.x}
                  y={coord.y - 8}
                  fontSize={10}
                  fontWeight="bold"
                  fill="#D4537E"
                  textAnchor="middle"
                >
                  {points[index].kyun_score}%
                </text>
              </>
            )}
            {showAllLabels && (
              <text
                x={coord.x}
                y={height - 1}
                fontSize={8}
                fill="#B8B8B8"
                textAnchor={
                  index === 0 ? "start" : index === lastIndex ? "end" : "middle"
                }
              >
                {formatShortDate(points[index].date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const THEMES = [
  { key: "casual_sex_seeking", label: "身体的な関係" },
  { key: "self_priority", label: "自分優先" },
  { key: "relationship_ambiguity", label: "関係の曖昧さ" },
] as const;

function ThemeEvaluation({
  variables,
  evaluations,
}: {
  variables: Record<string, number>;
  evaluations: Record<string, string>;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const theme = THEMES[selectedIndex];
  const dangerScore = Math.max(0, Math.min(100, variables[theme.key] ?? 0));

  return (
    <section className="mt-[24px] flex w-[calc(100%_-_52px)] max-w-[300px] flex-col rounded-lg bg-white p-4">
      <h2 className="text-[16px] leading-[23px] font-bold text-[#D4537E]">
        テーマ別評価
      </h2>
      <div
        className="mt-3 grid grid-cols-3 gap-1"
        role="tablist"
        aria-label="テーマ別評価"
      >
        {THEMES.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selectedIndex === index}
            onClick={() => setSelectedIndex(index)}
            className={`min-h-10 rounded-md px-1 text-[11px] leading-[15px] font-bold ${selectedIndex === index ? "bg-[#D4537E] text-white" : "bg-[#FFF5F8] text-[#D4537E]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel" aria-label={`${theme.label}の評価`}>
        <div className="flex items-center justify-between text-[12px] font-bold text-[#D4537E]">
          <span>危険度</span>
          <span>{dangerScore}%</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#FDE8EF]">
          <div
            className="h-full rounded-full bg-[#D4537E] transition-[width] duration-300"
            style={{ width: `${dangerScore}%` }}
          />
        </div>
        <p className="mt-3 rounded-lg bg-[#FFF5F8] px-3 py-2 text-[12px] leading-[18px] text-[#6B4B57]">
          {evaluations[theme.key] ??
            "このテーマの所感はありません。会話の流れを見ながら確認しましょう。"}
        </p>
      </div>
    </section>
  );
}

export function Result() {
  const router = useRouter();
  const {
    kyunScore,
    evaluation,
    timeline,
    kyunMessages,
    cautionMessages,
    variables,
    themeEvaluations,
  } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Re-read the store directly rather than trusting the `kyunScore` render
    // value here: the first client render intentionally reuses the SSR
    // placeholder (kyunScore === null) to avoid a hydration mismatch, and
    // this effect can fire against that placeholder before the corrected
    // render lands. Reading live sessionStorage sidesteps that race.
    if (getSnapshot().kyunScore === null) {
      router.replace("/");
    }
  }, [kyunScore, router]);

  if (kyunScore === null) {
    return null;
  }

  const trend = timeline.length >= 2 ? describeTrend(timeline) : null;

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

          <h2 className="mt-[15px] text-[20px] leading-[29px] font-bold text-[#D4537E]">
            きゅん度
          </h2>

          <div className="mt-[10px] flex h-[150px] w-[220px] max-w-[calc(100%_-_48px)] shrink-0 items-center justify-center rounded-[20px] border border-[#F5B6D2] bg-[#FFF5FA] text-[44px] leading-none font-bold text-[#D4537E]">
            {kyunScore}%
          </div>

          <h2 className="mt-6 text-[20px] leading-[29px] font-bold text-[#D4537E]">
            判定理由
          </h2>

          <div className="mt-2 h-[150px] w-[220px] max-w-[calc(100%_-_48px)] shrink-0 overflow-y-auto rounded-[20px] border border-[#F5B6D2] bg-[#FFF5FA] px-4 py-3 text-left text-[16px] leading-[1.8] text-[#555555]">
            {evaluation}
          </div>

          <button
            type="button"
            className="mt-[22px] h-12 w-[140px] rounded-lg bg-[#FAE1FA] text-[24px] leading-none font-bold text-[#FF99B4] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          >
            共有
          </button>
        </section>

        <ThemeEvaluation variables={variables} evaluations={themeEvaluations} />

        {timeline.length >= 2 && trend && (
          <section className="mt-[24px] flex w-[calc(100%_-_52px)] max-w-[300px] flex-col items-center rounded-lg bg-white p-4">
            <div className="flex w-[220px] max-w-full items-baseline justify-between">
              <h2 className="text-[16px] leading-[23px] font-bold text-[#D4537E]">
                きゅん度の推移
              </h2>
              <span className={`text-[13px] font-bold ${trend.className}`}>
                {trend.arrow} {trend.label}
              </span>
            </div>
            <div className="mt-2 h-[110px] w-[220px] max-w-full">
              <TimelineChart points={timeline} />
            </div>
            {timeline.length > 6 && (
              <div className="mt-1 flex w-[220px] max-w-full justify-between text-[10px] text-[#B8B8B8]">
                <span>{formatShortDate(timeline[0].date)}</span>
                <span>
                  {formatShortDate(timeline[timeline.length - 1].date)}
                </span>
              </div>
            )}
          </section>
        )}

        <section className="mt-[24px] flex w-[calc(100%_-_52px)] max-w-[300px] flex-col gap-4 rounded-lg bg-white p-4">
          <div>
            <h2 className="text-[16px] leading-[23px] font-bold text-[#D4537E]">
              きゅんした発言
            </h2>
            {kyunMessages.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {kyunMessages.map((message) => (
                  <li
                    key={message}
                    className="rounded-[12px] bg-[#FFF5F8] px-3 py-2 text-[12px] leading-[17px] text-[#D4537E]"
                  >
                    「{message}」
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] leading-[17px] text-[#B8B8B8]">
                特にありません
              </p>
            )}
          </div>
          <div>
            <h2 className="text-[16px] leading-[23px] font-bold text-[#E08A3C]">
              気になる発言
            </h2>
            {cautionMessages.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {cautionMessages.map((message) => (
                  <li
                    key={message}
                    className="rounded-[12px] bg-[#FFF3E6] px-3 py-2 text-[12px] leading-[17px] text-[#B5651D]"
                  >
                    「{message}」
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] leading-[17px] text-[#B8B8B8]">
                特にありません
              </p>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-[83px] h-12 w-[140px] rounded-lg bg-[#FF99B4] text-[20px] leading-none text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        >
          新しく調査
        </button>
      </main>
    </div>
  );
}
