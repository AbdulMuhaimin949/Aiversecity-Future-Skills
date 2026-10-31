/** Deterministic barcode: bar widths are derived from the character codes of the role's real source IDs. */
export function barcodeBars(sourceIds: string[]): { x: number; w: number }[] {
  const seed = sourceIds.length ? sourceIds.join("|") : "NO-SOURCE";
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const push = (w: number) => {
    bars.push({ x, w });
    x += w + 1.6;
  };
  push(1.4); push(1.4); // start guard
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      const bit = ((c * (k + 3) + i * 7) >> k) & 3;
      push(1 + bit * 0.9);
      x += ((c >> (k + 1)) & 1) * 1.2;
    }
  }
  push(1.4); push(1.4);
  return bars;
}

export function SourceBarcode({ sourceIds, className }: { sourceIds: string[]; className?: string }) {
  const bars = barcodeBars(sourceIds);
  const total = bars.length ? bars[bars.length - 1].x + bars[bars.length - 1].w : 1;
  return (
    <div className={className} data-testid="barcode-sources">
      <svg viewBox={`0 0 ${total} 30`} preserveAspectRatio="none" className="h-9 w-full" role="img" aria-label={`Verified source barcode for ${sourceIds.join(", ")}`}>
        {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={30} fill="#18191C" />)}
      </svg>
      <div className="font-data mt-1 break-all text-center text-[8px] leading-tight tracking-wider text-[#18191C]" data-testid="text-barcode-sources">{sourceIds.length ? sourceIds.join(" · ") : "no source ids"}</div>
    </div>
  );
}
