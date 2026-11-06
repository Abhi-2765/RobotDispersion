export function SimulationControls({
  round,
  stage,
  isRunning,
  speed,
  onSpeedChange,
  onStep,
  onPreviousStep,
  previousDisabled = false,
  onToggleRun,
  onReset,
  disabled = false,
}) {
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-4 border-y border-border py-3" aria-label="Simulation controls">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs text-foreground-muted">Round</p>
          <p className="mt-0.5 text-base font-medium tabular-nums">{String(round).padStart(3, "0")}</p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted">Stage</p>
          <p className="mt-0.5 text-sm font-medium">{stage}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 flex items-center gap-2 text-xs text-foreground-muted">
          Speed
          <select
            className="rounded-md border border-border bg-surface px-2 py-2 text-foreground"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            disabled={disabled}
            aria-label="Simulation speed"
          >
            <option value={1000}>Slow</option>
            <option value={400}>Normal</option>
            <option value={120}>Fast</option>
          </select>
        </label>
        <button type="button" disabled={previousDisabled} onClick={onPreviousStep} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
          Previous step
        </button>
        <button type="button" disabled={disabled} onClick={onStep} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
          Step
        </button>
        <button type="button" disabled={disabled} onClick={onToggleRun} className="min-w-24 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          {isRunning ? "Pause" : "Run"}
        </button>
        <button type="button" onClick={onReset} className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground">
          Reset
        </button>
      </div>
    </section>
  );
}
