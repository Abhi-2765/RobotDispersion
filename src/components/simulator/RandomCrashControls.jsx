export function RandomCrashControls({
  threshold,
  onThresholdChange,
  autoCrash,
  onToggleAutoCrash,
  onRollCrash,
  aliveCount,
  disabled = false,
}) {
  return (
    <div className="border-t border-border bg-surface p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-bold text-danger">
          <span>🎲</span>
          <span>Random Crash Injection</span>
        </h4>
        <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
          {aliveCount} alive
        </span>
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
        Assigns each robot a random number [0–100%]. If the roll is below the threshold, the robot crashes and alerts you.
      </p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="crash-threshold-slider" className="text-foreground-muted">
            Crash Threshold: <strong className="font-semibold text-foreground">{threshold}%</strong>
          </label>
        </div>
        <input
          id="crash-threshold-slider"
          type="range"
          min="1"
          max="50"
          step="1"
          value={threshold}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
          disabled={disabled}
          className="w-full cursor-pointer accent-danger"
        />
        <div className="flex justify-between text-[10px] text-foreground-muted">
          <span>1% (Low)</span>
          <span>10% (Default)</span>
          <span>50% (Extreme)</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onRollCrash}
          disabled={disabled || aliveCount <= 1}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 border border-danger/60 bg-danger/10 px-3 text-xs font-bold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
          title="Roll random crash check for all alive robots"
        >
          🎲 Roll Random Crash Now
        </button>

        <label className="flex cursor-pointer select-none items-center gap-2 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={autoCrash}
            onChange={onToggleAutoCrash}
            disabled={disabled}
            className="rounded accent-danger"
          />
          <span>Auto-roll random crash on each step</span>
        </label>
      </div>
    </div>
  );
}
