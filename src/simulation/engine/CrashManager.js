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

  /**
   * Assigns a randomized number [0, 1) to all living robots.
   * If the random number is strictly less than threshold, the robot crashes.
   * Preserves at least `minSurvivors` (default 1) so dispersion invariant f < k holds.
   *
   * @param {Array<Robot>} robots - Swarm of robots
   * @param {number} threshold - Probability threshold between 0 and 1 (e.g. 0.10 for 10%)
   * @param {object} [options]
   * @param {number} [options.minSurvivors=1]
   * @returns {{ crashedRobots: Array<{ id: number, roll: number, threshold: number, nodeId: number|null }>, totalChecked: number }}
   */
  rollRandomCrashes(robots, threshold = 0.10, { minSurvivors = 1 } = {}) {
    const living = robots.filter((r) => r.alive);
    if (living.length <= minSurvivors) {
      return { crashedRobots: [], totalChecked: living.length };
    }

    const maxAllowedCrashes = Math.max(0, living.length - minSurvivors);
    const crashedRobots = [];

    for (const robot of living) {
      if (crashedRobots.length >= maxAllowedCrashes) break;

      const roll = Math.random();
      if (roll < threshold) {
        const nodeId = robot.currentNode?.id ?? null;
        this.crash(robot);
        crashedRobots.push({
          id: robot.id,
          roll: Number(roll.toFixed(3)),
          threshold: Number(threshold.toFixed(3)),
          nodeId,
        });
      }
    }

    return {
      crashedRobots,
      totalChecked: living.length,
    };
  }
}
