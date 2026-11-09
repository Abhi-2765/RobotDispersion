import { CommunicationManager } from "./CommunicationManager.js";
import { MovementManager } from "./MovementManager.js";

export class SimulationEngine {
  constructor(simulation, algorithm, options = {}) {
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
    this.crashProbability = options.crashProbability ?? 0;
    this.random = options.random ?? Math.random;

    this.communicationManager = new CommunicationManager();
    this.movementManager = new MovementManager();
  }

  setCrashProbability(probability) {
    this.crashProbability = Math.max(0, Math.min(1, probability));
  }

  injectFaults() {
    if (this.crashProbability <= 0) return [];
    const crashed = [];
    const living = this.simulation.robots.filter((r) => r.alive);
    if (living.length <= 1) return [];

    for (const robot of living) {
      // Keep at least 1 robot alive
      if (this.simulation.robots.filter((r) => r.alive).length <= 1) break;
      if (this.random() < this.crashProbability) {
        robot.crash();
        crashed.push(robot.id);
      }
    }
    return crashed;
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
    const previousRound = this.simulation.round;
    const previousStage = this.algorithm.getStage?.(previousRound) ?? null;
    const stageCount = this.algorithm.getStageCount?.() ?? 3;
    let nextRound = previousRound + 1;
    let stageTransition = null;

    // Stage-aware algorithms can provide a global checker. A completed stage
    // advances on the next step, preserving the paper's round timeline by
    // jumping over its unused waiting rounds.
    if (
      Number.isInteger(previousStage) &&
      previousStage < stageCount &&
      this.algorithm.isStageComplete?.(this.simulation, previousStage)
    ) {
      const boundary = this.algorithm.getStageBoundary?.(previousStage);
      const nextStage = previousStage + 1;
      if (Number.isInteger(boundary)) nextRound = Math.max(nextRound, boundary + 1);

      this.algorithm.advanceStage?.();
      stageTransition = {
        fromStage: previousStage,
        toStage: nextStage,
        fromRound: previousRound,
        toRound: nextRound,
      };
    }

    try {
    const crashedRobotIds = this.injectFaults();

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
      stageTransition,
      crashedRobotIds,
      observations,
      inboxes,
      decisions,
      movements: movementResult.count,
      movementDetails: movementResult.details,
    };
    } catch (error) {
      if (stageTransition) this.algorithm.setStage?.(stageTransition.fromStage);
      throw error;
    }
  }

  get round() {
    return this.simulation.round;
  }
}
