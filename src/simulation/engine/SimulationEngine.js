import { CommunicationManager } from "./CommunicationManager.js";
import { MovementManager } from "./MovementManager.js";

export class SimulationEngine {
  constructor(simulation, algorithm) {
    if (!simulation?.grid || !Array.isArray(simulation.robots)) {
      throw new Error("Invalid simulation.");
    }

    if (
      typeof algorithm?.createMessage !== "function" ||
      typeof algorithm?.compute !== "function"
    ) {
      throw new Error(
        "Algorithm must implement createMessage() and compute()."
      );
    }

    this.simulation = simulation;
    this.algorithm = algorithm;

    this.communicationManager = new CommunicationManager();
    this.movementManager = new MovementManager();
  }

  getObservations() {
    const observations = {};

    for (const robot of this.simulation.robots) {
      if (!robot.alive) continue;

      const node = robot.currentNode;

      observations[robot.id] = {
        robotId: robot.id,
        degree: node.getDegree(),
        ports: [...node.ports.keys()],

        coLocatedRobotIds: node.robots
          .filter((other) => other.alive)
          .map((other) => other.id),

        memory: structuredClone(robot.memory),
        traversalHistory: structuredClone(robot.traversalHistory),
      };
    }

    return observations;
  }

  step() {
    const nextRound = this.simulation.round + 1;

    // Phase 1: Communicate
    const observations = this.getObservations();

    const inboxes = this.communicationManager.exchange(
      this.simulation.robots,
      observations,
      this.algorithm,
      nextRound
    );

    // Phase 2: Compute
    const decisions = {};

    for (const robot of this.simulation.robots) {
      if (!robot.alive) continue;

      const observation = observations[robot.id];
      const inbox = inboxes[robot.id] ?? [];

      const decision =
        this.algorithm.compute(observation, inbox, nextRound) ?? {};

      if (typeof decision !== "object" || Array.isArray(decision)) {
        throw new Error(
          `Algorithm returned an invalid decision for robot ${robot.id}.`
        );
      }

      decisions[robot.id] = decision;
    }

    // Phase 3: Move
    const movementResult = this.movementManager.execute(
      this.simulation.robots,
      decisions,
      nextRound
    );

    this.simulation.round = nextRound;

    return {
      round: nextRound,
      observations,
      inboxes,
      decisions,
      movements: movementResult.count,
      movementDetails: movementResult.details,
    };
  }

  get round() {
    return this.simulation.round;
  }
}
