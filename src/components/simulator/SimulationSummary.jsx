export function SimulationSummary({
  gridSize,
  robotCount,
  occupiedNodes,
  algorithmMode,
  variant = "card",
}) {
  const algorithm = algorithmMode === "nonFaulty" ? "Non-faulty" : "Faulty";

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
        <span>Grid <strong className="font-semibold text-foreground">{gridSize} × {gridSize}</strong></span>
        <span>Robots <strong className="font-semibold text-foreground">{robotCount}</strong></span>
        {occupiedNodes !== undefined ? <span>Occupied <strong className="font-semibold text-foreground">{occupiedNodes}</strong></span> : null}
        <span>Algorithm <strong className="font-semibold text-foreground">{algorithm}</strong></span>
      </div>
    );
  }

  return (
    <aside className="border border-border bg-surface p-4" aria-label="Simulation details">
      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Simulation details</h3>
      <dl className="mt-2 divide-y divide-border">
        <SummaryRow label="Grid size" value={`${gridSize} × ${gridSize}`} />
        <SummaryRow label="Robots" value={robotCount} />
        <SummaryRow label="Occupied nodes" value={occupiedNodes} />
        <SummaryRow label="Algorithm" value={algorithm} />
      </dl>
    </aside>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
