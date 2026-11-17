/**
 * Builds display node objects for GridNetworkSvg and NodeInspector
 * (id, robots, getDegree, getNeighbours) from the read-only graph view and a
 * frame, with full reciprocal references so that getEdges works seamlessly.
 */
export function buildDisplayNodes(view, frame, staticRobots) {
  const robotsByNode = new Map();
  const place = (robotId, nodeId) => {
    if (!robotsByNode.has(nodeId)) robotsByNode.set(nodeId, []);
    robotsByNode.get(nodeId).push({ id: robotId });
  };
  for (const robot of staticRobots) place(robot.id, robot.nodeId);
  for (const [robotId, nodeId] of Object.entries(frame.positions)) place(Number(robotId), nodeId);

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
