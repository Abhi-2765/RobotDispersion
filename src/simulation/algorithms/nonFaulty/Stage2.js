import { BoundaryTraversal } from "./navigation/BoundaryTraversal.js";

const MEMORY_KEY = "nonFaultyStage2";

/**
 * Stage 2: gather the non-singleton corner groups at the corner containing
 * the smallest-ID robot that reached a corner.
 *
 * The highest-ID robot at every corner containing more than one robot makes
 * one complete boundary tour. The other robots remain at that corner and
 * advertise the IDs originally present there. A singleton corner remains
 * stationary; if that corner is the destination, the explorer encounters
 * the singleton robot there. Otherwise it remains settled for Stage 3 to
 * treat as an occupied node. Internal singleton robots are not Stage 2 targets.
 */
export class Stage2 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Stage 2 requires a square grid size of at least 2.");
    }

    this.perimeterEdges = 4 * size - 4;
  }

  createMessage(observation) {
    const state = observation.memory[MEMORY_KEY];
    if (!state) return null;

    if (state.role === "keeper" || state.role === "singleton-corner") {
      if (observation.degree === 2) {
        return {
          type: "stage2-corner-info",
          cornerRobotIds: state.cornerRobotIds,
        };
      }
    }

    if (state.role === "scout" && state.phase === "target-ready") {
      return {
        type: "stage2-target",
        targetId: state.minimumId,
        firstPort: state.targetPort,
        distance: state.targetDistance,
      };
    }

    return null;
  }

  compute(observation, inbox) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) return this.initialize(observation);

    if (state.role === "singleton-corner" || state.role === "keeper") {
      return this.computeKeeper(observation, inbox, state);
    }

    if (state.role === "scout") {
      return this.computeScout(observation, inbox, state);
    }

    return { action: { type: "stay" } };
  }

  initialize(observation) {
    // Internal singleton robots remain settled. Stage 1 has already moved
    // every boundary robot and every non-singleton internal group to corners.
    if (observation.degree !== 2) {
      return { action: { type: "stay" } };
    }

    const ids = [...observation.coLocatedRobotIds].sort((a, b) => a - b);
    if (ids.length === 1) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "singleton-corner",
            cornerRobotIds: ids,
          },
        },
      };
    }

    const scoutId = ids[ids.length - 1];

    if (observation.robotId !== scoutId) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "keeper",
            cornerRobotIds: ids,
          },
        },
      };
    }

    const ports = [...observation.ports].sort((a, b) => a - b);
    const firstPort = ports[0];
    const reversePort = ports[1];

    const start = BoundaryTraversal.start(observation, firstPort, {
      remainingEdges: this.perimeterEdges,
    });

    return {
      action: start.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          role: "scout",
          phase: "tour",
          cornerRobotIds: ids,
          startPort: firstPort,
          reversePort,
          steps: 0,
          minimumId: ids[0],
          targetOffset: 0,
          walker: start.state,
        },
      },
    };
  }

  computeKeeper(observation, inbox, state) {
    const target = inbox.find(
      (message) => message.payload?.type === "stage2-target"
    );

    if (target) {
      const distance = target.payload.distance;
      if (distance === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: {
              ...state,
              role: "keeper",
              phase: "arrived",
              targetId: target.payload.targetId,
            },
          },
        };
      }

      const started = BoundaryTraversal.start(
        observation,
        target.payload.firstPort,
        { remainingEdges: distance }
      );

      return {
        action: started.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            role: "keeper",
            phase: "travelling",
            targetId: target.payload.targetId,
            walker: started.state,
          },
        },
      };
    }

    if (state.phase === "arrived") {
      return { action: { type: "stay" } };
    }

    if (state.phase === "travelling") {
      const result = BoundaryTraversal.advance(observation, state.walker);
      const arrived = result.state.phase === "arrived";
      return {
        action: arrived ? { type: "stay" } : result.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: arrived ? "arrived" : "travelling",
            walker: result.state,
          },
        },
      };
    }

    return { action: { type: "stay" } };
  }

  computeScout(observation, inbox, previousState) {
    const state = structuredClone(previousState);

    if (state.phase === "target-ready") {
      if (state.targetDistance === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: { [MEMORY_KEY]: { ...state, phase: "arrived" } },
        };
      }

      const started = BoundaryTraversal.start(
        observation,
        state.targetPort,
        { remainingEdges: state.targetDistance }
      );

      return {
        action: started.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: "travelling",
            walker: started.state,
          },
        },
      };
    }

    if (state.phase === "arrived") {
      return { action: { type: "stay" } };
    }

    if (state.phase === "travelling") {
      const result = BoundaryTraversal.advance(observation, state.walker);
      const arrived = result.state.phase === "arrived";
      return {
        action: arrived ? { type: "stay" } : result.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: arrived ? "arrived" : "travelling",
            walker: result.state,
          },
        },
      };
    }

    if (state.phase !== "tour") {
      return { action: { type: "stay" } };
    }

    const result = BoundaryTraversal.advance(observation, state.walker);
    state.walker = result.state;

    if (result.edgeCompleted) {
      state.steps += 1;
    }

    // At each corner, inspect the robots physically there and the IDs
    // advertised by its stationary keeper. IDs from the scout's own corner
    // are already included in cornerRobotIds.
    if (result.edgeCompleted && observation.degree === 2) {
      const candidates = [...observation.coLocatedRobotIds];
      for (const message of inbox) {
        if (message.payload?.type === "stage2-corner-info") {
          candidates.push(...message.payload.cornerRobotIds);
        }
      }

      if (candidates.length > 0) {
        const candidateMinimum = Math.min(...candidates);
        if (candidateMinimum < state.minimumId) {
          state.minimumId = candidateMinimum;
          state.targetOffset = state.steps;
        }
      }
    }

    if (state.steps >= this.perimeterEdges) {
      const forwardDistance = state.targetOffset;
      const backwardDistance = this.perimeterEdges - forwardDistance;
      const useForward = forwardDistance <= backwardDistance;

      state.targetDistance = useForward ? forwardDistance : backwardDistance;
      state.targetPort = useForward
        ? state.startPort
        : state.reversePort;
      state.phase = "target-ready";

      return {
        action: { type: "stay" },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    return {
      action: result.action,
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }
}
