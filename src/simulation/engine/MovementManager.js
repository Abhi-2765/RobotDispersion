export class MovementManager {
  execute(robots, decisions, round) {
    const movements = [];

    for (const robot of robots) {
      if (!robot.alive) continue;

      const decision = decisions[robot.id] ?? {};
      const action = decision.action;

      if (!action || action.type === "stay") continue;

      if (action.type !== "move") {
        throw new Error(`Invalid action for robot ${robot.id}.`);
      }

      const outgoingPort = action.port;
      const origin = robot.currentNode;
      const destination = origin.ports.get(outgoingPort);

      if (!destination) {
        throw new Error(
          `Robot ${robot.id} selected invalid port ${outgoingPort}.`
        );
      }

      const incomingPort = [...destination.ports.entries()]
        .find(([, neighbour]) => neighbour === origin)?.[0];

      if (incomingPort === undefined) {
        throw new Error("Grid connection is not reciprocal.");
      }

      movements.push({
        robot,
        origin,
        destination,
        outgoingPort,
        incomingPort,
      });
    }

    for (const robot of robots) {
      if (!robot.alive) continue;

      const memoryUpdates = decisions[robot.id]?.memoryUpdates;

      if (memoryUpdates) {
        Object.assign(robot.memory, memoryUpdates);
      }
    }

    for (const movement of movements) {
      movement.origin.removeRobot(movement.robot.id);
    }

    for (const movement of movements) {
      const {
        robot,
        destination,
        outgoingPort,
        incomingPort,
      } = movement;

      robot.setCurrentNode(destination);
      robot.remember("incomingPort", incomingPort);
      robot.recordTraversal(round, outgoingPort, incomingPort);

      destination.addRobot(robot);
    }

    return {
      count: movements.length,
      details: movements.map(
        ({ robot, outgoingPort, incomingPort }) => ({
          robotId: robot.id,
          outgoingPort,
          incomingPort,
        })
      ),
    };
  }
}