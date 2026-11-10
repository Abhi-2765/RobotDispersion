import { FaultyBoundaryTraversal } from "./navigation/FaultyBoundaryTraversal.js";

const MEMORY_KEY = "faultyStage3";

/**
 * Stage 3 (Faulty): Disperse all robots such that each occupies a distinct node.
 *
 * Implements Section 4.1 Stage 3 of Banerjee et al.:
 * - If robot count Crm ≤ 4√n - 4:
 *   Disperse robots along the perimeter edges by ID rank.
 * - If Crm > 4√n - 4:
 *   Batch column dispersion: dispatch ⌊Crm / (√n - R0 - 2)⌋ robots into interior
 *   columns, settling one robot per vacant node, until remaining robots fit on perimeter.
 */
export class FaultyStage3 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Faulty Stage 3 requires a square grid size of at least 2.");
    }

    this.size = size;
    this.perimeterEdges = 4 * size - 4;
  }

  createMessage(observation) {
    const state = observation.memory[MEMORY_KEY];
    if (!state) return null;

    if (state.role === "root" && state.phase === "plan-ready") {
      return {
        type: "faulty-stage3-plan",
        assignments: state.assignments,
        rootId: state.rootId,
      };
    }

    if (state.phase === "settled") {
      return {
        type: "faulty-stage3-settled",
        robotId: observation.robotId,
      };
    }

    return null;
  }

  compute(observation, inbox) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) return this.initialize(observation);

    if (state.phase === "settled") {
      return { action: { type: "stay" } };
    }

    if (state.role === "root") {
      return this.computeRoot(observation, state);
    }

    if (state.role === "waiting-plan") {
      return this.computeWaiting(observation, inbox);
    }

    if (state.role === "perimeter-walker") {
      return this.computePerimeterWalker(observation, inbox, state);
    }

    if (state.role === "column-walker") {
      return this.computeColumnWalker(observation, inbox, state);
    }

    return { action: { type: "stay" } };
  }

  initialize(observation) {
    // 1. Existing settled singletons from Stage 1 or singleton corners remain settled
    if (
      observation.degree === 4 &&
      observation.memory.faultyStage1?.status === "settled-singleton"
    ) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: { role: "settled-singleton", phase: "settled" },
        },
      };
    }

    if (
      observation.degree === 2 &&
      observation.coLocatedRobotIds.length === 1 &&
      observation.memory.faultyStage2?.role === "singleton-corner"
    ) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: { role: "settled-corner", phase: "settled" },
        },
      };
    }

    // 2. Corner gathering node C0: multiple robots present
    if (observation.degree === 2) {
      const coLocatedIds = [...observation.coLocatedRobotIds].sort((a, b) => a - b);
      const rootId = coLocatedIds[0];

      if (observation.robotId === rootId) {
        // Coordinator creates dispersion assignments skipping already-occupied corners
        const occupiedCornerSteps = observation.memory.faultyStage2?.occupiedCornerSteps ?? [];
        const assignments = this.createDispersionPlan(coLocatedIds, occupiedCornerSteps);
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: {
              role: "root",
              phase: "plan-ready",
              rootId,
              assignments,
              cRm: coLocatedIds.length,
              r0: 0,
            },
          },
        };
      }

      // Other robots at corner wait for plan
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "waiting-plan",
            phase: "waiting-plan",
            rootId,
          },
        },
      };
    }

    // Default: stay settled
    return {
      action: { type: "stay" },
      memoryUpdates: { [MEMORY_KEY]: { phase: "settled" } },
    };
  }

  createDispersionPlan(robotIds, occupiedSteps = []) {
    const assignments = {};
    const total = robotIds.length;
    const maxPerimeter = this.perimeterEdges;
    const occupiedSet = new Set(occupiedSteps);

    // Free perimeter steps (excluding 0, which is the root corner itself, and any occupied corners)
    const freeSteps = [];
    for (let s = 1; s < maxPerimeter; s++) {
      if (!occupiedSet.has(s)) {
        freeSteps.push(s);
      }
    }

    if (total <= freeSteps.length + 1) {
      // Direct perimeter dispersion by rank
      robotIds.forEach((id, rank) => {
        assignments[id] = {
          mode: "perimeter",
          targetSteps: rank === 0 ? 0 : freeSteps[rank - 1],
        };
      });
      return assignments;
    }

    // Batch column dispersion + perimeter
    const interiorColumns = Math.max(1, this.size - 2);
    let assignedIndex = 0;

    for (let c = 0; c < interiorColumns && assignedIndex < total - freeSteps.length - 1; c++) {
      const colIndex = c + 1;
      const batchSize = Math.min(
        this.size,
        Math.max(1, Math.floor((total - assignedIndex) / (this.size - c)))
      );

      for (let b = 0; b < batchSize && assignedIndex < total - freeSteps.length - 1; b++) {
        const id = robotIds[assignedIndex++];
        assignments[id] = {
          mode: "column",
          columnIndex: colIndex,
          depth: b + 1,
        };
      }
    }

    // Remaining robots take free perimeter positions
    let perimRank = 0;
    while (assignedIndex < total) {
      const id = robotIds[assignedIndex++];
      assignments[id] = {
        mode: "perimeter",
        targetSteps: perimRank === 0 ? 0 : (freeSteps[perimRank - 1] ?? perimRank),
      };
      perimRank++;
    }

    return assignments;
  }

  computeRoot(observation, state) {
    // If root already broadcast the plan, it adopts its own assignment
    const myAssignment = state.assignments?.[observation.robotId];
    if (myAssignment) {
      return this.startAssignment(observation, myAssignment);
    }
    return { action: { type: "stay" } };
  }

  computeWaiting(observation, inbox) {
    const planMsg = inbox.find((m) => m.payload?.type === "faulty-stage3-plan");
    if (planMsg?.payload?.assignments) {
      const myAssignment = planMsg.payload.assignments[observation.robotId];
      if (myAssignment) {
        return this.startAssignment(observation, myAssignment);
      }
    }
    return { action: { type: "stay" } };
  }

  startAssignment(observation, assignment) {
    if (assignment.mode === "perimeter") {
      if (assignment.targetSteps === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: { role: "settled", phase: "settled" },
          },
        };
      }

      const port = Math.min(...observation.ports);
      const start = FaultyBoundaryTraversal.start(observation, port, {
        remainingEdges: assignment.targetSteps,
      });

      return {
        action: start.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "perimeter-walker",
            phase: "moving-perimeter",
            targetSteps: assignment.targetSteps,
            steps: 0,
            walker: start.state,
          },
        },
      };
    }

    if (assignment.mode === "column") {
      const port = Math.min(...observation.ports);
      const start = FaultyBoundaryTraversal.start(observation, port, {
        remainingEdges: assignment.columnIndex,
      });

      return {
        action: start.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "column-walker",
            phase: "to-column-entry",
            columnIndex: assignment.columnIndex,
            targetDepth: assignment.depth,
            currentDepth: 0,
            walker: start.state,
          },
        },
      };
    }

    return { action: { type: "stay" } };
  }

  computePerimeterWalker(observation, inbox, state) {
    const result = FaultyBoundaryTraversal.advance(observation, state.walker);
    const arrived = result.state.phase === "arrived";

    if (arrived) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: "settled",
            role: "settled",
          },
        },
      };
    }

    return {
      action: result.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          walker: result.state,
        },
      },
    };
  }

  computeColumnWalker(observation, inbox, state) {
    // 1. Walking along perimeter to column entry
    if (state.phase === "to-column-entry") {
      const result = FaultyBoundaryTraversal.advance(observation, state.walker);
      const atEntry = result.state.phase === "arrived";

      if (atEntry) {
        // At boundary entry of column (degree 3). Find the interior port
        const incomingPort = observation.memory.incomingPort;
        const lastPort = state.walker?.lastBoundaryPort;
        const interiorPort = observation.ports.find(
          (p) => p !== incomingPort && p !== lastPort
        ) ?? Math.max(...observation.ports);

        return {
          action: { type: "move", port: interiorPort },
          memoryUpdates: {
            [MEMORY_KEY]: {
              ...state,
              phase: "moving-down-column",
              currentDepth: 1,
            },
          },
        };
      }

      return {
        action: result.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            walker: result.state,
          },
        },
      };
    }

    // 2. Moving down the column
    if (state.phase === "moving-down-column") {
      if (state.currentDepth >= state.targetDepth) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: {
              ...state,
              phase: "settled",
              role: "settled",
            },
          },
        };
      }

      // Continue moving down column: pick port other than incomingPort
      const incomingPort = observation.memory.incomingPort;
      const nextPort = observation.ports.find((p) => p !== incomingPort) ?? observation.ports[0];

      return {
        action: { type: "move", port: nextPort },
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            currentDepth: state.currentDepth + 1,
          },
        },
      };
    }

    return { action: { type: "stay" } };
  }
}
