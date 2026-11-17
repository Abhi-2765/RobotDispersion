import { PLAYBACK_SPEEDS } from "../../hooks/usePlayback.js";

export function PlaybackControls({ round, frameNumber, frameCount, playback }) {
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-4 border-y border-border py-3" aria-label="Demonstration controls">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs text-foreground-muted">Round</p>
          <p className="mt-0.5 text-base font-medium tabular-nums">{String(round).padStart(3, "0")}</p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted">Frame</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums">{frameNumber} / {frameCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 flex items-center gap-2 text-xs text-foreground-muted">
          Speed
          <select
            className="rounded-md border border-border bg-surface px-2 py-2 text-foreground"
            value={playback.speed}
            onChange={(event) => playback.setSpeed(Number(event.target.value))}
            aria-label="Playback speed"
          >
            <option value={PLAYBACK_SPEEDS.slow}>Slow</option>
            <option value={PLAYBACK_SPEEDS.normal}>Normal</option>
            <option value={PLAYBACK_SPEEDS.fast}>Fast</option>
          </select>
        </label>
        <button type="button" disabled={playback.atStart} onClick={playback.prev} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
          Previous
        </button>
        <button type="button" disabled={playback.atEnd} onClick={playback.next} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
          Next
        </button>
        <button type="button" onClick={playback.toggle} className="min-w-24 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          {playback.isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={playback.reset} className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground">
          Reset
        </button>
      </div>
    </section>
  );
}
