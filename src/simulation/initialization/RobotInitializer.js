
import { Robot } from "../models/Robot.js";

export class RobotInitializer {
  constructor(grid, random = Math.random) {
    this.grid = grid;
    this.random = random;
  }

  // Randomly place robots across the grid
  randomPlacement(count) {
    this.validateCount(count);

    const nodes = this.grid.getAllNodes();
    const robots = [];

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(
        this.random() * nodes.length
      );

      const node = nodes[randomIndex];
      const robot = new Robot(i + 1, node);

      node.addRobot(robot);
      robots.push(robot);
    }

    return robots;
  }

  // Place robots at user-selected node positions
  customPlacement(placements) {
    if (!Array.isArray(placements) || placements.length === 0) {
      throw new Error("At least one robot placement is required.");
    }

    const nodes = this.grid.getAllNodes();
    const robots = [];

    placements.forEach((nodeIndex, index) => {
      if (
        !Number.isInteger(nodeIndex) ||
        nodeIndex < 0 ||
        nodeIndex >= nodes.length
      ) {
        throw new Error(`Invalid starting node for robot ${index + 1}.`);
      }

      const node = nodes[nodeIndex];
      const robot = new Robot(index + 1, node);

      node.addRobot(robot);
      robots.push(robot);
    });

    return robots;
  }

  validateCount(count) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > this.grid.getTotalNodes()
    ) {
      throw new Error(
        "Robot count must be between 1 and the total number of grid nodes."
      );
    }
  }
}
