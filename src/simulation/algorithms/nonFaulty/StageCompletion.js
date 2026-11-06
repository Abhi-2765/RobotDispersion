const STAGE1_KEY = "nonFaultyStage1";
const STAGE2_KEY = "nonFaultyStage2";

function livingRobots(simulation) {
  return simulation.robots.filter((robot) => robot.alive);
}

export function isStage1Complete(simulation) {
  const robots = livingRobots(simulation);
  if (robots.length === 0) return false;

  return robots.every((robot) => {
    const degree = robot.currentNode.getDegree();
    if (degree === 2) return true;

    return degree === 4 &&
      robot.currentNode.robots.filter((other) => other.alive).length === 1 &&
      robot.memory[STAGE1_KEY]?.status === "settled-singleton";
  });
}

export function isStage2Complete(simulation) {
  const robots = livingRobots(simulation);
  if (!isStage1Complete(simulation) || robots.length === 0) return false;

  const movingCornerGroups = robots.filter((robot) => {
    const role = robot.memory[STAGE2_KEY]?.role;
    return role === "keeper" || role === "scout";
  });
  if (movingCornerGroups.length === 0) {
    const hasUninitializedCornerGroup = simulation.grid.getAllNodes().some((node) =>
      node.getDegree() === 2 &&
      node.robots.filter((robot) => robot.alive).length > 1
    );
    return !hasUninitializedCornerGroup;
  }

  const arrivals = movingCornerGroups.map((robot) => {
    const state = robot.memory[STAGE2_KEY];
    return {
      robot,
      state,
      targetId: state.role === "scout" ? state.minimumId : state.targetId,
    };
  });

  if (arrivals.some(({ state, targetId }) => state.phase !== "arrived" || !Number.isInteger(targetId))) {
    return false;
  }

  const targetIds = new Set(arrivals.map(({ targetId }) => targetId));
  if (targetIds.size !== 1) return false;

  const targetRobot = robots.find((robot) => robot.id === arrivals[0].targetId);
  return Boolean(targetRobot) && arrivals.every(
    ({ robot }) => robot.currentNode === targetRobot.currentNode
  );
}

export function isStage3Complete(simulation) {
  const robots = livingRobots(simulation);
  if (robots.length === 0) return false;

  return new Set(robots.map((robot) => robot.currentNode)).size === robots.length;
}

export function getNonFaultyStageProgress(simulation, currentStage = 1) {
  // Stage 1 and 2 describe transient configurations. Once the engine has
  // advanced, dispersion necessarily changes those configurations, so retain
  // their completion based on the monotonic stage number.
  const stage1Complete = currentStage > 1 || isStage1Complete(simulation);
  const stage2Complete = currentStage > 2 ||
    (stage1Complete && isStage2Complete(simulation));
  const stage3Complete = currentStage === 3 && isStage3Complete(simulation);

  return [
    {
      number: 1,
      title: "Move robots to corners",
      complete: stage1Complete,
    },
    {
      number: 2,
      title: "Gather corner groups",
      complete: stage2Complete,
    },
    {
      number: 3,
      title: "Disperse robots",
      complete: stage3Complete,
    },
  ];
}
