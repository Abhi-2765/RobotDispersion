export class SimulationEngine {
  constructor(simulation, algorithm) {
    if (!simulation?.grid || !Array.isArray(simulation.robots)) {
      throw new Error("Invalid simulation.");
    }

    if (
      typeof algorithm?.communicate !== "function" ||
      typeof algorithm?.compute !== "function"
    ) {
      throw new Error("Algorithm must implement communicate() and compute().");
    }

    this.simulation = simulation;
    this.algorithm = algorithm;
  }

  // restricted observations for each alive robot
  getObservations() {
    const observations = {};

    for (const robot of this.simulation.robots) {
      if (!robot.alive) continue;

      const node = robot.currentNode;

      observations[robot.id] = {
        robotId: robot.id,
        degree: node.getDegree(),

        // Only local port numbers are exposed
        ports: [...node.ports.keys()],

        // Only robots at the same node are visible
        coLocatedRobotIds: node.robots
          .filter((other) => other.alive)
          .map((other) => other.id),

        // Private memory belonging to this robot
        memory: { ...robot.memory },
      };
    }

    return observations;
  }

  // one round
  step() {
    const observations = this.getObservations();
    const nextRound = this.simulation.round + 1;

    // Communicate
    const messages = this.algorithm.communicate(
      observations,
      nextRound
    ) ?? {};

    // Compute
    const decisions = this.algorithm.compute(
      observations,
      messages,
      nextRound
    ) ?? {};

    // Apply memory updates and collect movement decisions
    const movements = [];

    for (const robot of this.simulation.robots) {
      if (!robot.alive) continue;

      const decision = decisions[robot.id] ?? {};
      const { action, memoryUpdates } = decision;

      if (memoryUpdates) {
        Object.assign(robot.memory, memoryUpdates);
      }

      if (!action || action.type === "stay") continue;

      if (action.type !== "move") {
        throw new Error(`Invalid action for robot ${robot.id}.`);
      }

      const outgoingPort = action.port;
      const destination = robot.currentNode.ports.get(outgoingPort);

      if (!destination) {
        throw new Error(
          `Robot ${robot.id} selected invalid port ${outgoingPort}.`
        );
      }

      // Find the destination's local port back to the origin
      const incomingPort = [...destination.ports.entries()]
        .find(([, neighbour]) => neighbour === robot.currentNode)?.[0];

      if (incomingPort === undefined) {
        throw new Error("Grid connection is not reciprocal.");
      }

      movements.push({
        robot,
        origin: robot.currentNode,
        destination,
        outgoingPort,
        incomingPort,
      });
    }

    // Move
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

      robot.recordTraversal(
        nextRound,
        outgoingPort,
        incomingPort
      );

      destination.addRobot(robot);
    }

    this.simulation.round = nextRound;

    return {
      round: nextRound,
      observations,
      messages,
      decisions,
      movements: movements.length,
    };
  }
}
