export class CrashManager {
  crash(robot) {
    if (!robot) {
      throw new Error("Invalid robot.");
    }

    if (!robot.alive) {
      return false;
    }

    if (!robot.currentNode) {
      throw new Error(`Robot ${robot.id} has no current node.`);
    }

    robot.currentNode.removeRobot(robot.id);

    robot.crash();

    return true;
  }

  crashById(robots, robotId) {
    const robot = robots.find((item) => item.id === robotId);

    if (!robot) {
      throw new Error(`Robot ${robotId} not found.`);
    }

    return this.crash(robot);
  }
}