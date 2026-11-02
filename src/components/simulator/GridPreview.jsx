import { GridNetworkSvg } from "./GridNetworkSvg.jsx";

export function GridPreview({ gridSize, nodes, selectedNodeId, onSelectNode, showPorts, onTogglePorts }) {
  const occupiedCount = nodes.filter((node) => node.robots.length > 0).length;
  const totalNodes = gridSize * gridSize;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Grid preview">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium">Grid</h3>
        <button
          type="button"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          aria-pressed={showPorts}
          onClick={onTogglePorts}
        >
          {showPorts ? "Hide ports" : "Show ports"}
        </button>
      </div>

      <GridNetworkSvg
        nodes={nodes}
        gridSize={gridSize}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        showPorts={showPorts}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs text-foreground-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-accent" />Robot</span>
          <span className="flex items-center gap-2"><i className="size-2 rounded-full border border-border-strong" />Empty</span>
        </div>
        <span>{occupiedCount} occupied · {totalNodes - occupiedCount} empty</span>
      </div>
      <p className="px-4 pb-3 text-xs text-foreground-muted">Port numbers are local to each node.</p>
    </section>
  );
}
