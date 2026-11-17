export function TutorialSelectionPage({
  onSelectStraightPath,
  onSelectBoundary,
}) {
  return (
    <section className="mx-auto max-w-4xl py-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tutorial 1: Straight-Path Discovery */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-foreground">Straight-Path Discovery</h3>
            <p className="text-sm leading-relaxed text-foreground-muted">
              On an unoriented grid without compass directions, robots cannot locally determine which opposite port continues in a straight line.
              Watch how a co-located group at an internal node explores candidate ports and identifies the straight line via systematic exploration.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onSelectStraightPath}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors"
            >
              Start Straight-Path Tutorial →
            </button>
          </div>
        </div>

        {/* Tutorial 2: Boundary Traversal */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-foreground">Boundary Traversal</h3>
            <p className="text-sm leading-relaxed text-foreground-muted">
              Boundary nodes have degree 3, with two perimeter ports and one interior port.
              Observe how a single boundary robot navigates towards a corner in at most 3 rounds per hop with O(1) memory by probing internal nodes and immediately back tracking.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onSelectBoundary}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors"
            >
              Start Boundary Traversal Tutorial →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
