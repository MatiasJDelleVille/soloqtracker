export type LpGap = {
  toNext: number | null;
  toPrevious: number | null;
};

export default function LpGapBox({ toNext, toPrevious }: LpGap) {
  if (toNext === null && toPrevious === null) return null;

  return (
    <div className="flex flex-col text-xs leading-tight items-end w-16 shrink-0 font-mono">
      <span className="text-emerald-400" title="LP para alcanzar al siguiente">
        {toNext !== null ? `▲${toNext}` : "—"}
      </span>
      <span className="text-red-400" title="LP de margen sobre el anterior">
        {toPrevious !== null ? `▼${toPrevious}` : "—"}
      </span>
    </div>
  );
}
