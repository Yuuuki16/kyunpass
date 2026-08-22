"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import type {
  AnalyzeResult,
  ShareableResult,
  TimelinePoint,
} from "@/features/result/resultData";
import { Zen_Maru_Gothic } from "next/font/google";
import { useRouter } from "next/navigation";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

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

type AnimalId =
  "penguin" | "cat" | "koala" | "fox" | "lion" | "dolphin" | "wolf" | "panther";

type AnimalType = {
  animal: AnimalId;
  name: string;
  description: string;
};

const ANIMAL_TYPES = {
  "000": {
    animal: "penguin",
    name: "一途なペンギンタイプ",
    description: "誠実で安定した関係を大切にするタイプ",
  },
  "001": {
    animal: "cat",
    name: "気まぐれネコタイプ",
    description: "優しいけれど、関係性や距離感がつかみにくいタイプ",
  },
  "010": {
    animal: "koala",
    name: "マイペースコアラタイプ",
    description: "関係は明確でも、自分の時間や都合を優先するタイプ",
  },
  "011": {
    animal: "fox",
    name: "つかみどころのないキツネタイプ",
    description: "自分のペースを保ち、関係性を曖昧にしやすいタイプ",
  },
  "100": {
    animal: "lion",
    name: "情熱的なライオンタイプ",
    description: "相手を尊重しながら、スキンシップにも積極的なタイプ",
  },
  "101": {
    animal: "dolphin",
    name: "自由奔放なイルカタイプ",
    description: "距離は近くても、関係の形には縛られたくないタイプ",
  },
  "110": {
    animal: "wolf",
    name: "本能派オオカミタイプ",
    description: "関係は明確でも、自分の欲求やペースを出しやすいタイプ",
  },
  "111": {
    animal: "panther",
    name: "刺激追求クロヒョウタイプ",
    description: "刺激を求め、自分中心で曖昧な関係になりやすいタイプ",
  },
} satisfies Record<string, AnimalType>;

function getAnimalType(variables: Record<string, number>): AnimalType {
  const isHigh = (key: (typeof THEMES)[number]["key"]) =>
    (variables[key] ?? 0) >= 50;
  const animalKey =
    `${isHigh("casual_sex_seeking") ? 1 : 0}${isHigh("self_priority") ? 1 : 0}${isHigh("relationship_ambiguity") ? 1 : 0}` as keyof typeof ANIMAL_TYPES;

  return ANIMAL_TYPES[animalKey];
}

function AnimalIllustration({ animal }: { animal: AnimalId }) {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" aria-hidden="true">
      <circle cx="48" cy="48" r="46" fill="#FFF5FA" />

      {animal === "penguin" && (
        <>
          <ellipse cx="48" cy="51" rx="27" ry="34" fill="#3F4553" />
          <ellipse cx="48" cy="59" rx="18" ry="24" fill="#FFFFFF" />
          <ellipse
            cx="24"
            cy="56"
            rx="7"
            ry="18"
            fill="#3F4553"
            transform="rotate(20 24 56)"
          />
          <ellipse
            cx="72"
            cy="56"
            rx="7"
            ry="18"
            fill="#3F4553"
            transform="rotate(-20 72 56)"
          />
          <circle cx="39" cy="39" r="3" fill="#242733" />
          <circle cx="57" cy="39" r="3" fill="#242733" />
          <path d="M42 47 L48 43 L54 47 L48 51 Z" fill="#F4A261" />
          <circle cx="34" cy="48" r="4" fill="#FFB3C7" />
          <circle cx="62" cy="48" r="4" fill="#FFB3C7" />
        </>
      )}

      {animal === "cat" && (
        <>
          <path d="M24 38 L28 15 L43 31 Z" fill="#E9A88F" />
          <path d="M72 38 L68 15 L53 31 Z" fill="#E9A88F" />
          <path d="M29 30 L31 21 L38 31 Z" fill="#F7CAD7" />
          <path d="M67 30 L65 21 L58 31 Z" fill="#F7CAD7" />
          <circle cx="48" cy="51" r="29" fill="#E9A88F" />
          <path
            d="M37 49 Q41 45 45 49"
            fill="none"
            stroke="#4C3A3A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M51 49 Q55 45 59 49"
            fill="none"
            stroke="#4C3A3A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M44 57 L48 60 L52 57 Z" fill="#D4537E" />
          <path
            d="M48 60 Q44 66 40 62 M48 60 Q52 66 56 62"
            fill="none"
            stroke="#4C3A3A"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M35 57 L18 53 M35 62 L17 64 M61 57 L78 53 M61 62 L79 64"
            fill="none"
            stroke="#7A5A57"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}

      {animal === "koala" && (
        <>
          <circle cx="25" cy="36" r="16" fill="#AEB4BE" />
          <circle cx="71" cy="36" r="16" fill="#AEB4BE" />
          <circle cx="25" cy="36" r="9" fill="#F4C4D2" />
          <circle cx="71" cy="36" r="9" fill="#F4C4D2" />
          <ellipse cx="48" cy="52" rx="28" ry="30" fill="#C7CBD2" />
          <circle cx="38" cy="47" r="3" fill="#454955" />
          <circle cx="58" cy="47" r="3" fill="#454955" />
          <ellipse cx="48" cy="57" rx="9" ry="11" fill="#555967" />
          <path
            d="M44 69 Q48 73 52 69"
            fill="none"
            stroke="#555967"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="32" cy="57" r="4" fill="#EFAFC2" />
          <circle cx="64" cy="57" r="4" fill="#EFAFC2" />
        </>
      )}

      {animal === "fox" && (
        <>
          <path d="M20 40 L27 13 L43 32 Z" fill="#E9834B" />
          <path d="M76 40 L69 13 L53 32 Z" fill="#E9834B" />
          <path d="M27 29 L29 20 L37 31 Z" fill="#F6B5B5" />
          <path d="M69 29 L67 20 L59 31 Z" fill="#F6B5B5" />
          <path
            d="M48 23 C66 23 76 38 73 55 C70 73 58 82 48 84 C38 82 26 73 23 55 C20 38 30 23 48 23 Z"
            fill="#E9834B"
          />
          <path
            d="M25 51 Q35 50 48 72 Q61 50 71 51 Q68 75 48 84 Q28 75 25 51 Z"
            fill="#FFF8F4"
          />
          <path
            d="M34 49 Q39 45 43 49 M53 49 Q57 45 62 49"
            fill="none"
            stroke="#55382E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M44 66 L48 69 L52 66 Z" fill="#55382E" />
        </>
      )}

      {animal === "lion" && (
        <>
          <circle cx="48" cy="49" r="38" fill="#C9824A" />
          <circle cx="24" cy="35" r="10" fill="#C9824A" />
          <circle cx="72" cy="35" r="10" fill="#C9824A" />
          <circle cx="48" cy="51" r="27" fill="#F4C36A" />
          <circle cx="37" cy="48" r="3" fill="#50382E" />
          <circle cx="59" cy="48" r="3" fill="#50382E" />
          <ellipse cx="48" cy="59" rx="6" ry="5" fill="#8E5940" />
          <path
            d="M48 64 Q43 69 39 65 M48 64 Q53 69 57 65"
            fill="none"
            stroke="#8E5940"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="32" cy="59" r="4" fill="#F2A7B9" />
          <circle cx="64" cy="59" r="4" fill="#F2A7B9" />
        </>
      )}

      {animal === "dolphin" && (
        <>
          <path
            d="M15 59 C24 35 49 25 72 35 C80 38 84 44 84 48 C77 45 70 45 64 47 C55 50 50 58 42 63 C33 69 23 67 15 59 Z"
            fill="#69B7D6"
          />
          <path
            d="M47 40 C43 29 49 21 57 18 C55 27 58 33 64 37 Z"
            fill="#4A9DBF"
          />
          <path
            d="M25 62 C19 73 11 75 7 72 C14 67 16 62 15 57 Z"
            fill="#4A9DBF"
          />
          <path
            d="M70 43 C78 38 87 39 91 44 C84 46 79 49 75 53 Z"
            fill="#69B7D6"
          />
          <circle cx="67" cy="40" r="2.5" fill="#27566A" />
          <path
            d="M70 51 Q61 59 50 60"
            fill="none"
            stroke="#DFF4FA"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="73" cy="47" r="4" fill="#FFB3C7" opacity="0.8" />
        </>
      )}

      {animal === "wolf" && (
        <>
          <path d="M19 40 L27 11 L43 34 Z" fill="#7D8798" />
          <path d="M77 40 L69 11 L53 34 Z" fill="#7D8798" />
          <path d="M28 29 L30 19 L37 32 Z" fill="#D7AEBB" />
          <path d="M68 29 L66 19 L59 32 Z" fill="#D7AEBB" />
          <path
            d="M48 22 C67 22 76 38 72 58 C68 74 57 83 48 86 C39 83 28 74 24 58 C20 38 29 22 48 22 Z"
            fill="#8F99A9"
          />
          <path d="M48 40 L66 68 Q58 82 48 86 Q38 82 30 68 Z" fill="#D9DCE2" />
          <path
            d="M32 49 L42 47 M54 47 L64 49"
            stroke="#38404C"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="38" cy="50" r="2" fill="#2D3440" />
          <circle cx="58" cy="50" r="2" fill="#2D3440" />
          <path d="M43 66 L48 70 L53 66 Z" fill="#38404C" />
          <path
            d="M48 70 Q48 75 43 76 M48 70 Q48 75 53 76"
            fill="none"
            stroke="#596270"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}

      {animal === "panther" && (
        <>
          <circle cx="27" cy="31" r="13" fill="#343340" />
          <circle cx="69" cy="31" r="13" fill="#343340" />
          <circle cx="27" cy="31" r="7" fill="#6D5667" />
          <circle cx="69" cy="31" r="7" fill="#6D5667" />
          <ellipse cx="48" cy="52" rx="30" ry="32" fill="#343340" />
          <path d="M31 47 Q38 41 45 47 Q38 52 31 47 Z" fill="#F080A5" />
          <path d="M51 47 Q58 41 65 47 Q58 52 51 47 Z" fill="#F080A5" />
          <circle cx="39" cy="47" r="2" fill="#2A1824" />
          <circle cx="57" cy="47" r="2" fill="#2A1824" />
          <path d="M43 60 L48 64 L53 60 Z" fill="#B86782" />
          <path
            d="M48 64 Q43 70 39 66 M48 64 Q53 70 57 66"
            fill="none"
            stroke="#C8A9B5"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M35 59 L16 55 M35 65 L15 67 M61 59 L80 55 M61 65 L81 67"
            fill="none"
            stroke="#8A7A84"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

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
  const animalType = getAnimalType(variables);

  return (
    <section className="mt-[24px] flex w-[calc(100%_-_52px)] max-w-[300px] flex-col rounded-lg bg-white p-4">
      <h2 className="text-[16px] leading-[23px] font-bold text-[#D4537E]">
        テーマ別評価
      </h2>
      <div
        className="mt-3 flex flex-col items-center rounded-xl border border-[#F5B6D2] bg-[#FFF5FA] px-3 py-3 text-center"
        aria-label={`アニマルタイプ: ${animalType.name}`}
      >
        <AnimalIllustration animal={animalType.animal} />
        <h3 className="mt-2 text-[16px] leading-[23px] font-bold text-[#D4537E]">
          {animalType.name}
        </h3>
        <p className="mt-1 text-[12px] leading-[18px] text-[#6B4B57]">
          {animalType.description}
        </p>
      </div>
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

type ResultProps = {
  initialResult?: ShareableResult;
};

type ShareStatus = "idle" | "saving" | "copied" | "manual" | "error";

export function Result({ initialResult }: ResultProps) {
  const router = useRouter();
  const storedResult = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const {
    kyunScore,
    evaluation,
    timeline,
    kyunMessages,
    cautionMessages,
    variables,
    themeEvaluations,
  } = initialResult ?? storedResult;

  useEffect(() => {
    // Re-read the store directly rather than trusting the `kyunScore` render
    // value here: the first client render intentionally reuses the SSR
    // placeholder (kyunScore === null) to avoid a hydration mismatch, and
    // this effect can fire against that placeholder before the corrected
    // render lands. Reading live sessionStorage sidesteps that race.
    if (!initialResult && getSnapshot().kyunScore === null) {
      router.replace("/");
    }
  }, [initialResult, kyunScore, router]);

  if (kyunScore === null) {
    return null;
  }

  const currentResult: ShareableResult = {
    kyunScore,
    evaluation,
    timeline,
    kyunMessages,
    cautionMessages,
    variables,
    themeEvaluations,
  };

  const handleShare = async () => {
    setShareStatus("saving");

    try {
      let nextShareUrl = shareUrl;

      if (!nextShareUrl) {
        if (initialResult) {
          nextShareUrl = window.location.href;
        } else {
          const response = await fetch("/api/shared-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentResult),
          });
          const responseBody: unknown = await response.json();
          const shareId =
            responseBody && typeof responseBody === "object"
              ? (responseBody as Record<string, unknown>).shareId
              : null;

          if (!response.ok || typeof shareId !== "string") {
            throw new Error("共有リンクを作成できませんでした");
          }

          nextShareUrl = `${window.location.origin}/result/${shareId}`;
        }

        setShareUrl(nextShareUrl);
      }

      try {
        if (!navigator.clipboard) {
          throw new Error("Clipboard APIを利用できません");
        }
        await navigator.clipboard.writeText(nextShareUrl);
        setShareStatus("copied");
      } catch {
        setShareStatus("manual");
        window.prompt("共有リンクをコピーしてください", nextShareUrl);
      }
    } catch {
      setShareStatus("error");
    }
  };

  const shareButtonLabel = {
    idle: "共有",
    saving: "作成中",
    copied: "コピー済み",
    manual: "再コピー",
    error: "再試行",
  }[shareStatus];

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
            onClick={handleShare}
            disabled={shareStatus === "saving"}
            className="mt-[22px] h-12 w-[140px] rounded-lg bg-[#FAE1FA] text-[24px] leading-none font-bold text-[#FF99B4] shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {shareButtonLabel}
          </button>
        </section>

        {shareStatus === "copied" && (
          <p
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#555555] px-4 py-2 text-[14px] text-white shadow-lg"
          >
            リンクをコピーしました
          </p>
        )}

        {shareStatus === "error" && (
          <p
            role="alert"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#555555] px-4 py-2 text-[14px] text-white shadow-lg"
          >
            共有リンクを作成できませんでした
          </p>
        )}

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
