/**
 * Builds reciprocal display node objects for GridNetworkSvg and NodeInspector
 * from the read-only graph view and the active boundary playback frame.
 */
export function buildBoundaryDisplayNodes(view, frame, staticRobots) {
  const robotsByNode = new Map();

  const place = (robotId, nodeId, isCrashed = false) => {
    if (!robotsByNode.has(nodeId)) robotsByNode.set(nodeId, []);
    robotsByNode.get(nodeId).push({ id: robotId, alive: !isCrashed });
  };

  for (const robot of staticRobots) {
    place(robot.id, robot.nodeId, false);
  }

  if (frame.activeRobotId !== null && frame.currentNodeId !== null) {
    place(frame.activeRobotId, frame.currentNodeId, frame.isCrashed);
  }

  const nodeMap = new Map();
  for (const id of view.nodeIds) {
    nodeMap.set(id, {
      id,
      robots: (robotsByNode.get(id) ?? []).sort((a, b) => a.id - b.id),
      getDegree: () => view.degree(id),
      ports: new Map(),
    });
  }

  for (const id of view.nodeIds) {
    const nodeObj = nodeMap.get(id);
    for (const [port, neighbourId] of view.neighbours(id)) {
      const neighbourObj = nodeMap.get(neighbourId);
      nodeObj.ports.set(port, neighbourObj);
    }
    nodeObj.getNeighbours = () => [...nodeObj.ports.entries()];
  }

  return [...nodeMap.values()];
}
