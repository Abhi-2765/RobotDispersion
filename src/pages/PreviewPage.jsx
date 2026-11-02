import { useState } from "react";
import { GridPreview } from "../components/simulator/GridPreview.jsx";
import { NodeInspector } from "../components/simulator/NodeInspector.jsx";

export function PreviewPage({ simulation, gridSize, algorithmMode, onBack, onRegenerate }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showPorts, setShowPorts] = useState(true);
  const nodes = simulation.grid.getAllNodes();
  const selectedNode = selectedNodeId === null
    ? null
    : nodes.find((node) => node.id === selectedNodeId) ?? null;

  function regenerate() {
    setSelectedNodeId(null);
    onRegenerate();
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" className="mb-3 text-sm text-foreground-muted hover:text-foreground" onClick={onBack}>← Configuration</button>
          <h2 className="text-xl font-medium tracking-tight">Starting configuration</h2>
          <p className="mt-1 text-sm text-foreground-muted">{gridSize} × {gridSize} grid · {simulation.robots.length} robots · {algorithmMode === "nonFaulty" ? "Non-faulty" : "Faulty"}</p>
        </div>
        <button type="button" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted" onClick={regenerate}>Regenerate</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <GridPreview
          gridSize={gridSize}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          showPorts={showPorts}
          onTogglePorts={() => setShowPorts((value) => !value)}
        />
        <NodeInspector node={selectedNode} gridSize={gridSize} />
      </div>
    </section>
  );
}
