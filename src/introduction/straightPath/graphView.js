/**
 * Read-only snapshot of the simulator's grid and robot placement.
 *
 * The introduction page never touches the live `simulation` object after this
 * copy is taken, so nothing here can mutate nodes, robots or the engine state.
 * Coordinates (row/column) are exposed only for drawing and explanatory text;
 * the demonstrated robots reason with local ports alone.
 */
export function buildGraphView(simulation) {
  const size = simulation.grid.size;
  const portTable = new Map();

  for (const node of simulation.grid.getAllNodes()) {
    portTable.set(
      node.id,
      node
        .getNeighbours()
        .map(([port, neighbour]) => [port, neighbour.id])
        .sort((a, b) => a[0] - b[0])
    );
  }

  const robots = simulation.robots
    .filter((robot) => robot.alive && robot.currentNode)
    .map((robot) => ({ id: robot.id, nodeId: robot.currentNode.id }))
    .sort((a, b) => a.id - b.id);

  const view = {
    size,
    round: simulation.round,
    robots,
    nodeIds: [...portTable.keys()],

    degree: (nodeId) => portTable.get(nodeId).length,
    ports: (nodeId) => portTable.get(nodeId).map(([port]) => port),
    neighbours: (nodeId) => portTable.get(nodeId),

    neighbour(nodeId, port) {
      const entry = portTable.get(nodeId).find(([p]) => p === port);
      if (!entry) throw new Error(`Node ${nodeId} has no port ${port}.`);
      return entry[1];
    },

    /** Port at the far end of the edge that leads back to `nodeId`. */
    reciprocalPort(nodeId, port) {
      const target = view.neighbour(nodeId, port);
      const back = portTable.get(target).find(([, id]) => id === nodeId);
      if (!back) throw new Error("Grid connection is not reciprocal.");
      return back[0];
    },

    robotIdsAt: (nodeId) =>
      robots.filter((robot) => robot.nodeId === nodeId).map((robot) => robot.id),

    /** Internal nodes holding two or more robots, largest group first. */
    internalGroups() {
      const counts = new Map();
      for (const robot of robots) {
        counts.set(robot.nodeId, (counts.get(robot.nodeId) ?? 0) + 1);
      }
      return [...counts.entries()]
        .filter(([nodeId, count]) => count >= 2 && view.degree(nodeId) === 4)
        .map(([nodeId, count]) => ({ nodeId, count }))
        .sort((a, b) => b.count - a.count || a.nodeId - b.nodeId);
    },
  };

  return view;
}
