const STAGE1_KEY = "faultyStage1";
const STAGE2_KEY = "faultyStage2";

function livingRobots(simulation) {
  return simulation.robots.filter((robot) => robot.alive);
}

export function isFaultyStage1Complete(simulation) {
  const robots = livingRobots(simulation);
  if (robots.length === 0) return true;

  return robots.every((robot) => {
    const degree = robot.currentNode?.getDegree();
    if (degree === 2) return true;

    if (degree === 4) {
      if (robot.memory.boundaryNavigation?.phase === "checking") return false;

      const coLocatedLiving = robot.currentNode.robots.filter((other) => other.alive);
      const isSettledSingleton =
        robot.memory[STAGE1_KEY]?.status === "settled-singleton" ||
        robot.memory.faultyStraightLineNavigation?.phase === "singleton";

      return coLocatedLiving.length === 1 && isSettledSingleton;
    }

    return false;
  });
}

export function isFaultyStage2Complete(simulation) {
  const robots = livingRobots(simulation);
  if (robots.length === 0) return true;
  if (!isFaultyStage1Complete(simulation)) return false;

  // Check if ANY living robot is currently on the boundary, on tour, waiting, or travelling
  const inTransit = robots.some((robot) => {
    if (robot.currentNode?.getDegree() === 3) return true;
    const state = robot.memory[STAGE2_KEY];
    if (!state) return false;
    return state.phase === "tour" || state.phase === "travelling" || state.phase === "waiting" || state.phase === "target-ready";
  });

  if (inTransit) return false;

  const cornerRobots = robots.filter((robot) => robot.currentNode?.getDegree() === 2);
  if (cornerRobots.length === 0) return true;

  // All non-singleton corner robots should have gathered at the same corner
  const nonSingletonCornerRobots = cornerRobots.filter(
    (robot) => robot.memory[STAGE2_KEY]?.role !== "singleton-corner"
  );

  if (nonSingletonCornerRobots.length <= 1) return true;

  const targetCorner = nonSingletonCornerRobots[0].currentNode;
  return nonSingletonCornerRobots.every((robot) => robot.currentNode === targetCorner);
}

export function isFaultyStage3Complete(simulation) {
  const robots = livingRobots(simulation);
  if (robots.length === 0) return true;

  const occupiedNodes = new Set(
    robots.map((robot) => robot.currentNode).filter(Boolean)
  );

  return occupiedNodes.size === robots.length;
}

export function getFaultyStageProgress(simulation, currentStage = 1) {
  const stage1Complete = currentStage > 1 || isFaultyStage1Complete(simulation);
  const stage2Complete =
    currentStage > 2 || (stage1Complete && isFaultyStage2Complete(simulation));
  const stage3Complete = currentStage === 3 && isFaultyStage3Complete(simulation);

  return [
    {
      number: 1,
      title: "Move to corners (fault-tolerant)",
      complete: stage1Complete,
    },
    {
      number: 2,
      title: "Gather at single corner (fault-tolerant)",
      complete: stage2Complete,
    },
    {
      number: 3,
      title: "Disperse to distinct nodes (fault-tolerant)",
      complete: stage3Complete,
    },
  ];
}
