const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 12;

export function ConfigurationPage({
  gridSize,
  robotCount,
  algorithmMode,
  onGridSizeChange,
  onRobotCountChange,
  onAlgorithmModeChange,
  onPreview,
}) {
  return (
    <section className="mx-auto max-w-xl">
      <h2 className="mb-7 text-xl font-medium tracking-tight">Configuration</h2>

      <div className="space-y-7 rounded-xl border border-border bg-surface p-5 sm:p-7">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label htmlFor="grid-size">Grid size</label>
            <span className="tabular-nums text-foreground-muted">{gridSize} × {gridSize}</span>
          </div>
          <input
            id="grid-size"
            className="w-full accent-primary"
            type="range"
            min={MIN_GRID_SIZE}
            max={MAX_GRID_SIZE}
            value={gridSize}
            onChange={(event) => onGridSizeChange(Number(event.target.value))}
          />
          <div className="mt-1 flex justify-between text-xs text-foreground-muted">
            <span>{MIN_GRID_SIZE} × {MIN_GRID_SIZE}</span>
            <span>{MAX_GRID_SIZE} × {MAX_GRID_SIZE}</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label htmlFor="robot-count">Robots</label>
            <span className="tabular-nums text-foreground-muted">{robotCount} / {gridSize * gridSize}</span>
          </div>
          <input
            id="robot-count"
            className="w-full accent-primary"
            type="range"
            min="1"
            max={gridSize * gridSize}
            value={robotCount}
            onChange={(event) => onRobotCountChange(Number(event.target.value))}
          />
          <p className="mt-1 text-xs text-foreground-muted">Total robots cannot exceed total grid nodes.</p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm">Algorithm</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={algorithmMode === "nonFaulty"}
              className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${algorithmMode === "nonFaulty" ? "border-primary bg-surface-muted text-foreground" : "border-border bg-transparent text-foreground-muted hover:bg-surface-muted/60"}`}
              onClick={() => onAlgorithmModeChange("nonFaulty")}
            >
              Non-faulty
            </button>
            <button
              type="button"
              aria-pressed={algorithmMode === "faulty"}
              className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${algorithmMode === "faulty" ? "border-primary bg-surface-muted text-foreground" : "border-border bg-transparent text-foreground-muted hover:bg-surface-muted/60"}`}
              onClick={() => onAlgorithmModeChange("faulty")}
            >
              Faulty
            </button>
          </div>
        </fieldset>

        <div className="flex items-center justify-between text-sm rounded-lg border px-2 py-2">
          <span>Starting positions: </span>
          <span className="text-foreground-muted">Random</span>
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          onClick={onPreview}
        >
          Preview configuration
        </button>
      </div>
    </section>
  );
}
