/**
 * Layout constants and geometry helpers shared by the grid renderer and overlay.
 * Port numbers describe fixed local sockets, not compass directions in the
 * underlying grid. The connection behind a socket is arbitrary.
 */
export const PITCH = 68;
export const PADDING = 42;
export const NODE_RADIUS = 20;
export const PORT_OFFSET = 18;
export const PORT_RADIUS = 7;

export const PORT_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

export function positionFor(node, size) {
  const id = typeof node === "number" ? node : node.id;
  return {
    x: PADDING + (id % size) * PITCH,
    y: PADDING + Math.floor(id / size) * PITCH,
  };
}

export function directionForPort(port) {
  return PORT_DIRECTIONS[port - 1] ?? { dx: 0, dy: 0 };
}

export function getCurvedEdgePath(startPos, endPos, outgoingDirection, incomingDirection) {
  const x1 = startPos.x + outgoingDirection.dx * PORT_OFFSET;
  const y1 = startPos.y + outgoingDirection.dy * PORT_OFFSET;
  const x2 = endPos.x + incomingDirection.dx * PORT_OFFSET;
  const y2 = endPos.y + incomingDirection.dy * PORT_OFFSET;
  const controlDistance = Math.min(
    PITCH * 1.1,
    Math.max(PITCH * 0.34, Math.hypot(x2 - x1, y2 - y1) * 0.28)
  );

  return `M ${x1} ${y1} C ${x1 + outgoingDirection.dx * controlDistance} ${y1 + outgoingDirection.dy * controlDistance}, ${x2 + incomingDirection.dx * controlDistance} ${y2 + incomingDirection.dy * controlDistance}, ${x2} ${y2}`;
}

export function getEdgePathBetween(fromNode, toNode, fromPort, toPort, size) {
  const start = positionFor(fromNode, size);
  const end = positionFor(toNode, size);
  const outgoingDirection = directionForPort(fromPort);
  const incomingDirection = directionForPort(toPort);
  return getCurvedEdgePath(start, end, outgoingDirection, incomingDirection);
}
