import { GridNetworkSvg } from "./GridNetworkSvg.jsx";

export function GridPreview({
  gridSize,
  nodes,
  selectedNodeId,
  selectedRobotId,
  onSelectNode,
  onSelectRobot,
  isMovingRobot = false,
  summary,
  interactionHint,
  viewportReserve,
}) {
  return (
    <section className="min-w-0 overflow-hidden border border-border bg-surface" aria-label="Grid preview">
      {summary ? <div className="border-b border-border/70 px-3 py-2">{summary}</div> : null}
      {interactionHint ? <div className="border-b border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">{interactionHint}</div> : null}
      <GridNetworkSvg
        nodes={nodes}
        gridSize={gridSize}
        selectedNodeId={selectedNodeId}
        selectedRobotId={selectedRobotId}
        onSelectRobot={onSelectRobot}
        isMovingRobot={isMovingRobot}
        onSelectNode={onSelectNode}
        viewportReserve={viewportReserve}
      />
    </section>
  );
}
