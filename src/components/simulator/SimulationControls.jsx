import {
  controlButtonClass,
  controlSelectClass,
  iconControlClass,
  primaryControlButtonClass,
} from "./controlStyles.js";

export function SimulationControls({
  round,
  isRunning,
  speed,
  onSpeedChange,
  onStep,
  onPreviousStep,
  previousDisabled = false,
  onToggleRun,
  onReset,
  disabled = false,
  children,
}) {
  return (
    <section className="sticky top-0 z-30 mb-4 grid items-center gap-3 border border-border-strong bg-surface px-3 py-2 xl:grid-cols-[auto_minmax(0,1fr)_auto]" aria-label="Simulation controls and stage progress">
      <div className="flex min-w-0 items-center xl:pr-2">
        <div className="flex items-baseline gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Round</p>
          <p className="text-lg font-bold tabular-nums">{String(round).padStart(3, "0")}</p>
        </div>
      </div>

      {children ? <div className="min-w-0 border-y border-border py-2 xl:border-x xl:border-y-0 xl:px-3 xl:py-0">{children}</div> : null}

      <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
        <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <span>Speed</span>
          <select
            className={controlSelectClass}
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            disabled={disabled}
          >
            <option value={1000}>Slow</option>
            <option value={400}>Normal</option>
            <option value={120}>Fast</option>
          </select>
        </label>
        <button type="button" disabled={previousDisabled} onClick={onPreviousStep} className={iconControlClass} aria-label="Previous step" title="Previous step">
          ←
        </button>
        <button type="button" disabled={disabled} onClick={onStep} className={iconControlClass} aria-label="Next step" title="Next step">
          →
        </button>
        <button type="button" disabled={disabled} onClick={onToggleRun} className={`${primaryControlButtonClass} min-w-20`}>
          {isRunning ? "Pause" : "Run"}
        </button>
        <button type="button" onClick={onReset} className={controlButtonClass}>
          Reset
        </button>
      </div>
    </section>
  );
}
