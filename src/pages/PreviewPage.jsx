import { useState } from "react";
import { GridPreview } from "../components/simulator/GridPreview.jsx";
import { NodeInspector } from "../components/simulator/NodeInspector.jsx";
import { RobotInspector } from "../components/simulator/RobotInspector.jsx";
import { SimulationSummary } from "../components/simulator/SimulationSummary.jsx";
import {
  controlButtonClass,
  primaryControlButtonClass,
} from "../components/simulator/controlStyles.js";

export function PreviewPage({ simulation, gridSize, algorithmMode, onRegenerate, onStart }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [movingRobotId, setMovingRobotId] = useState(null);
  const nodes = simulation.grid.getAllNodes();
  const selectedNode = selectedNodeId === null
    ? null
    : nodes.find((node) => node.id === selectedNodeId) ?? null;

  function regenerate() {
    setSelectedNodeId(null);
    setSelectedRobotId(null);
    setMovingRobotId(null);
    onRegenerate();
  }

  function selectRobot(robotId) {
    const robot = simulation.robots.find((item) => item.id === robotId);
    setSelectedRobotId(robotId);
    if (robot?.currentNode) setSelectedNodeId(robot.currentNode.id);
    setMovingRobotId(null);
  }

  function selectNode(nodeId) {
    setSelectedNodeId(nodeId);
    if (movingRobotId === null) return;

    const robot = simulation.robots.find((item) => item.id === movingRobotId);
    const destination = simulation.grid.getNodeById(nodeId);
    if (!robot?.alive || !destination) {
      setMovingRobotId(null);
      return;
    }

    if (robot.currentNode !== destination) {
      robot.currentNode.removeRobot(robot.id);
      robot.setCurrentNode(destination);
      destination.addRobot(robot);
    }

    setSelectedRobotId(robot.id);
    setMovingRobotId(null);
  }

  return (
    <section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <GridPreview
          gridSize={gridSize}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          selectedRobotId={selectedRobotId}
          onSelectNode={selectNode}
          onSelectRobot={selectRobot}
          isMovingRobot={movingRobotId !== null}
          summary={(
            <SimulationSummary
              gridSize={gridSize}
              robotCount={simulation.robots.length}
              algorithmMode={algorithmMode}
              variant="inline"
            />
          )}
          interactionHint={movingRobotId === null ? null : `Moving Robot ${movingRobotId}: choose a destination node.`}
          viewportReserve={14}
        />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" aria-label="Configuration preview actions">
            <button type="button" className={`${controlButtonClass} w-full px-2`} onClick={regenerate}>Regenerate</button>
            <button type="button" className={`${primaryControlButtonClass} w-full px-2`} onClick={onStart}>Simulate</button>
          </div>
          <RobotInspector
            robots={simulation.robots}
            selectedRobotId={selectedRobotId}
            onSelectRobot={selectRobot}
            gridSize={gridSize}
            onMoveRobot={setMovingRobotId}
            movingRobotId={movingRobotId}
            onCancelMove={() => setMovingRobotId(null)}
            mode="preview"
          />
          {selectedNode ? <NodeInspector node={selectedNode} gridSize={gridSize} /> : null}
        </div>
      </div>
    </section>
  );
}
