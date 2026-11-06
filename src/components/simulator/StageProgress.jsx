const STAGE_DETAILS = {
  1: "Groups and boundary robots reach corners. Internal singletons stay in place.",
  2: "Movable corner groups gather at the corner containing the minimum ID.",
  3: "Every robot occupies a distinct node.",
};

export function StageProgress({ stages, activeStage, onSelectStage }) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-surface p-4" aria-label="Stage progress">
      <h3 className="text-sm font-medium">Stage progress</h3>
      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {stages.map((stage) => {
          const isActive = stage.number === activeStage && !stage.complete;
          const status = stage.complete ? "Completed" : isActive ? "In progress" : "Waiting";
          const isSelectable = stage.complete || isActive;

          return (
            <li key={stage.number}>
              <button
                type="button"
                onClick={() => onSelectStage?.(stage.number)}
                disabled={!isSelectable}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${status}: Stage ${stage.number}, ${stage.title}${isSelectable ? ". Select to view this stage." : ". Complete the previous stage first."}`}
                className="h-full w-full rounded-lg border border-border bg-background p-3 text-left transition-colors enabled:hover:border-primary enabled:hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-70"
              >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Stage {stage.number}: {stage.title}</p>
                <span className={`shrink-0 text-xs ${stage.complete ? "text-success" : isActive ? "text-primary" : "text-foreground-muted"}`}>
                  {status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{STAGE_DETAILS[stage.number]}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
