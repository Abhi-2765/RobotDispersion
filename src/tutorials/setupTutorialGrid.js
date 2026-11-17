import { Grid } from "../simulation/models/Grid.js";
import { Robot } from "../simulation/models/Robot.js";

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Returns the central internal node ID (degree 4) for the given grid size.
 * For size 4, row 2, col 1 (node 9) is selected because port 1 connects to an
 * internal node under seed 1, yielding a complete straight-path demonstration.
 * For size 6, 8, 11, the geometric center (mid, mid) is used.
 */
export function getCentralInternalNodeId(gridSize) {
  if (gridSize === 4) {
    return 2 * 4 + 1; // node 9
  }
  const mid = Math.floor(gridSize / 2);
  return mid * gridSize + mid;
}

/**
 * Creates a deterministic educational simulation for the Straight-Path Discovery Tutorial:
 * - Deterministic port numbering (seed 1)
 * - Exactly 1 group of 4 robots at the central internal node (degree 4)
 * - All other nodes empty
 */
export function createStraightPathTutorialSimulation(gridSize) {
  const random = createSeededRandom(1);
  const grid = new Grid(gridSize, random);
  const centerNodeId = getCentralInternalNodeId(gridSize);
  const centerNode = grid.nodes.get(centerNodeId);

  const robots = [];
  for (let id = 1; id <= 4; id++) {
    const robot = new Robot(id, centerNode);
    centerNode.addRobot(robot);
    robots.push(robot);
  }

  return {
    grid,
    robots,
    round: 0,
    status: "ready",
  };
}

/**
 * Creates a deterministic educational simulation for the Boundary Traversal Tutorial:
 * - Deterministic port numbering (seed 1)
 * - Exactly 1 representative robot at boundary node 1 (row 0, col 1, degree 3)
 * - Groups of robots situated at all 4 corners (degree 2)
 */
export function createBoundaryTutorialSimulation(gridSize) {
  const random = createSeededRandom(1);
  const grid = new Grid(gridSize, random);

  const cornerNodeIds = [
    0, // Top-Left
    gridSize - 1, // Top-Right
    (gridSize - 1) * gridSize, // Bottom-Left
    gridSize * gridSize - 1, // Bottom-Right
  ];

  // 1 representative boundary robot at Node 1 (row 0, col 1)
  const boundaryNode = grid.nodes.get(1);
  const representativeRobot = new Robot(1, boundaryNode);
  boundaryNode.addRobot(representativeRobot);
  const robots = [representativeRobot];

  // Groups of 2 robots at each of the 4 corners
  let nextRobotId = 2;
  for (const cornerId of cornerNodeIds) {
    const cornerNode = grid.nodes.get(cornerId);
    for (let j = 0; j < 2; j++) {
      const robot = new Robot(nextRobotId++, cornerNode);
      cornerNode.addRobot(robot);
      robots.push(robot);
    }
  }

  return {
    grid,
    robots,
    round: 0,
    status: "ready",
  };
}
