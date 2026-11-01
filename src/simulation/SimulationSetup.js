
import { Grid } from "./models/Grid.js";
import { RobotInitializer } from "./initialization/RobotInitializer.js";

export function createSimulation({
  gridSize,
  robotCount,
  placementMode = "random",
  customPlacements = [],
  random = Math.random,
}) {
  const grid = new Grid(gridSize, random);

  const initializer = new RobotInitializer(grid, random);

  let robots;

  if (placementMode === "random") {
    robots = initializer.randomPlacement(robotCount);
  } else if (placementMode === "custom") {
    robots = initializer.customPlacement(customPlacements);
  } else {
    throw new Error("Invalid robot placement mode.");
  }

  return {
    grid,
    robots,
    round: 0,
    status: "ready",
  };
}
