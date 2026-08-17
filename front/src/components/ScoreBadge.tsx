type ScoreBadgeProps = {
  score: number;
};

export function ScoreBadge({ score }: ScoreBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700 dark:bg-pink-950 dark:text-pink-300">
      キュン度 {score}
    </span>
  );
}
