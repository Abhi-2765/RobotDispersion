const STAGE_DETAILS = {
  1: "Groups and boundary robots reach corners. Internal singletons stay in place.",
  2: "Movable corner groups gather at the corner containing the minimum ID.",
  3: "Every robot occupies a distinct node.",
};

export function StageProgress({ stages, activeStage, onSelectStage }) {
  return (
      <ol className="grid gap-1.5 md:grid-cols-3" aria-label="Stage progress">
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
                title={STAGE_DETAILS[stage.number]}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${status}: Stage ${stage.number}, ${stage.title}${isSelectable ? ". Select to view this stage." : ". Complete the previous stage first."}`}
                className={`h-full w-full border px-2.5 py-2 text-left transition-colors enabled:hover:border-primary enabled:hover:bg-surface-muted disabled:cursor-not-allowed ${isActive ? "border-primary/60 bg-primary/5" : "border-border bg-background disabled:opacity-60"}`}
              >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium sm:text-sm">{stage.number}. {stage.title}</p>
                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${stage.complete ? "bg-success/10 text-success" : isActive ? "bg-primary/10 text-primary" : "bg-surface-muted text-foreground-muted"}`}>
                  {status}
                </span>
              </div>
              </button>
            </li>
          );
        })}
      </ol>
  );
}
