export type LpGap = {
  toNext: number | null;
  toPrevious: number | null;
};

export default function LpGapBox({ toNext }: LpGap) {
  if (toNext === null) return null;

  return (
    <span
      className="text-xs font-mono text-emerald-400 shrink-0"
      title="LP para alcanzar al de arriba"
    >
      ▲{toNext}
    </span>
  );
}
