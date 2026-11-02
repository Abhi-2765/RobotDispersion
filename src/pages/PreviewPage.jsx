import { useState } from "react";
import { GridPreview } from "../components/simulator/GridPreview.jsx";
import { NodeInspector } from "../components/simulator/NodeInspector.jsx";
import { RobotInspector } from "../components/simulator/RobotInspector.jsx";

export function PreviewPage({ simulation, gridSize, algorithmMode, onBack, onRegenerate, onStart }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [showPorts, setShowPorts] = useState(true);
  const nodes = simulation.grid.getAllNodes();
  const selectedNode = selectedNodeId === null
    ? null
    : nodes.find((node) => node.id === selectedNodeId) ?? null;

  function regenerate() {
    setSelectedNodeId(null);
    setSelectedRobotId(null);
    onRegenerate();
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" className="mb-2 text-sm text-foreground-muted hover:text-foreground" onClick={onBack}>← Configuration</button>
          <h2 className="text-xl font-medium tracking-tight">Configuration preview</h2>
          <p className="mt-1 text-sm text-foreground-muted">{gridSize} × {gridSize} grid · {simulation.robots.length} robots · {algorithmMode === "nonFaulty" ? "Non-faulty" : "Faulty"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted" onClick={regenerate}>Regenerate</button>
          {algorithmMode === "nonFaulty" && <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover" onClick={onStart}>Start simulation</button>}
        </div>
      </div>

      {algorithmMode === "faulty" ? (
        <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground-muted">Faulty-robot execution is not implemented yet. You can still inspect this configuration.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <GridPreview
          gridSize={gridSize}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          showPorts={showPorts}
          onTogglePorts={() => setShowPorts((value) => !value)}
        />
        <div className="space-y-4">
          <NodeInspector node={selectedNode} gridSize={gridSize} />
          <RobotInspector
            robots={simulation.robots}
            selectedRobotId={selectedRobotId}
            onSelectRobot={setSelectedRobotId}
            gridSize={gridSize}
          />
        </div>
      </div>
    </section>
  );
}
