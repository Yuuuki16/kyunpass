export type TimelinePoint = {
  date: string;
  kyun_score: number;
};

export type AnalyzeResult = {
  kyunScore: number | null;
  evaluation: string;
  timeline: TimelinePoint[];
  kyunMessages: string[];
  cautionMessages: string[];
  variables: Record<string, number>;
  themeEvaluations: Record<string, string>;
};

export type ShareableResult = Omit<AnalyzeResult, "kyunScore"> & {
  kyunScore: number;
};

const MAX_EVALUATION_LENGTH = 10_000;
const MAX_TIMELINE_POINTS = 366;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_RECORD_ENTRIES = 100;
const MAX_RECORD_KEY_LENGTH = 100;
const MAX_RECORD_TEXT_LENGTH = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimeline(value: unknown): TimelinePoint[] | null {
  if (!Array.isArray(value) || value.length > MAX_TIMELINE_POINTS) return null;

  const points: TimelinePoint[] = [];
  for (const point of value) {
    if (!isRecord(point)) return null;

    const { date, kyun_score: kyunScore } = point;
    if (
      typeof date !== "string" ||
      date.length > MAX_RECORD_KEY_LENGTH ||
      typeof kyunScore !== "number" ||
      !Number.isFinite(kyunScore) ||
      kyunScore < 0 ||
      kyunScore > 100
    ) {
      return null;
    }

    points.push({ date, kyun_score: kyunScore });
  }

  return points;
}

function parseMessages(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_MESSAGES) return null;
  if (
    value.some(
      (message) =>
        typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH,
    )
  ) {
    return null;
  }
  return value as string[];
}

function parseNumberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_RECORD_ENTRIES) return null;

  for (const [key, numberValue] of entries) {
    if (
      key.length > MAX_RECORD_KEY_LENGTH ||
      typeof numberValue !== "number" ||
      !Number.isFinite(numberValue)
    ) {
      return null;
    }
  }

  return value as Record<string, number>;
}

function parseStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_RECORD_ENTRIES) return null;

  for (const [key, textValue] of entries) {
    if (
      key.length > MAX_RECORD_KEY_LENGTH ||
      typeof textValue !== "string" ||
      textValue.length > MAX_RECORD_TEXT_LENGTH
    ) {
      return null;
    }
  }

  return value as Record<string, string>;
}

export function parseShareableResult(value: unknown): ShareableResult | null {
  if (!isRecord(value)) return null;

  const {
    kyunScore,
    evaluation,
    timeline: timelineValue,
    kyunMessages: kyunMessagesValue,
    cautionMessages: cautionMessagesValue,
    variables: variablesValue,
    themeEvaluations: themeEvaluationsValue,
  } = value;

  if (
    typeof kyunScore !== "number" ||
    !Number.isFinite(kyunScore) ||
    kyunScore < 0 ||
    kyunScore > 100 ||
    typeof evaluation !== "string" ||
    evaluation.length > MAX_EVALUATION_LENGTH
  ) {
    return null;
  }

  const timeline = parseTimeline(timelineValue);
  const kyunMessages = parseMessages(kyunMessagesValue);
  const cautionMessages = parseMessages(cautionMessagesValue);
  const variables = parseNumberRecord(variablesValue);
  const themeEvaluations = parseStringRecord(themeEvaluationsValue);

  if (
    !timeline ||
    !kyunMessages ||
    !cautionMessages ||
    !variables ||
    !themeEvaluations
  ) {
    return null;
  }

  return {
    kyunScore,
    evaluation,
    timeline,
    kyunMessages,
    cautionMessages,
    variables,
    themeEvaluations,
  };
}
