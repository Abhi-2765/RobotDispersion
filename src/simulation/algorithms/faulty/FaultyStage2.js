import { FaultyRobotGroupHelper } from "./helpers/FaultyRobotGroupHelper.js";
import { FaultyBoundaryTraversal } from "./navigation/FaultyBoundaryTraversal.js";

const MEMORY_KEY = "faultyStage2";

/**
 * Stage 2 (Faulty): Gather movable corner groups at the single corner containing
 * the global minimum robot ID.
 *
 * Fault tolerance:
 * - Corners with t > 1 robots send ⌊t/2⌋ seekers along the perimeter.
 * - ⌈t/2⌉ non-seekers wait at the home corner with a 12√n round timeout.
 * - If seekers crash, non-seekers re-partition and retry (at most log n retries).
 * - If non-seekers crash, returning seekers migrate to the winner corner independently.
 */
export class FaultyStage2 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Faulty Stage 2 requires a square grid size of at least 2.");
    }

    this.size = size;
    this.perimeterEdges = 4 * size - 4;
    this.maxTourRounds = 12 * size;
  }

  createMessage(observation) {
    const state = observation.memory[MEMORY_KEY];
    if (!state) return null;

    if (observation.degree === 2) {
      // Non-seekers and singletons advertise their corner's minimum ID to visiting seekers
      if (state.role === "non-seeker" || state.role === "singleton-corner") {
        return {
          type: "faulty-stage2-corner-info",
          cornerRobotIds: state.cornerRobotIds,
          minimumId: state.knownMinimumId ?? state.cornerRobotIds?.[0],
        };
      }

      // Returned seeker tells home non-seekers where to migrate
      if (state.role === "seeker" && state.phase === "target-ready") {
        return {
          type: "faulty-stage2-target",
          targetId: state.minimumId,
          firstPort: state.targetPort,
          distance: state.targetDistance,
          occupiedCornerSteps: state.occupiedCornerSteps ?? [],
        };
      }
    }

    return null;
  }

  compute(observation, inbox, round) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) return this.initialize(observation, round);

    if (state.role === "singleton-corner" || state.role === "non-seeker") {
      return this.computeNonSeeker(observation, inbox, state, round);
    }

    if (state.role === "seeker") {
      return this.computeSeeker(observation, inbox, state);
    }

    return { action: { type: "stay" } };
  }

  initialize(observation, round) {
    // Internal nodes remain settled
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
            phase: "arrived",
            cornerRobotIds: ids,
            knownMinimumId: ids[0],
          },
        },
      };
    }

    const { waitingIds, scoutIds } = FaultyRobotGroupHelper.splitGroup(ids);
    const isSeeker = scoutIds.includes(observation.robotId);
    const timeoutRound = round + this.maxTourRounds;

    if (!isSeeker) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "non-seeker",
            phase: "waiting",
            cornerRobotIds: ids,
            seekerIds: scoutIds,
            nonSeekerIds: waitingIds,
            knownMinimumId: ids[0],
            timeoutRound,
          },
        },
      };
    }

    // Seeker: launch perimeter tour
    const ports = [...observation.ports].sort((a, b) => a - b);
    const firstPort = ports[0];
    const reversePort = ports[1] ?? ports[0];

    const start = FaultyBoundaryTraversal.start(observation, firstPort, {
      remainingEdges: this.perimeterEdges,
    });

    return {
      action: start.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          role: "seeker",
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

  computeNonSeeker(observation, inbox, state, round) {
    if (state.phase === "arrived") {
      return { action: { type: "stay" } };
    }

    // Check if target was received from returning seeker
    const targetMsg = inbox.find((m) => m.payload?.type === "faulty-stage2-target");
    if (targetMsg) {
      const distance = targetMsg.payload.distance;
      const occupiedCornerSteps = targetMsg.payload.occupiedCornerSteps ?? [];
      if (distance === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: {
              ...state,
              phase: "arrived",
              targetId: targetMsg.payload.targetId,
              occupiedCornerSteps,
            },
          },
        };
      }

      const started = FaultyBoundaryTraversal.start(
        observation,
        targetMsg.payload.firstPort,
        { remainingEdges: distance }
      );

      return {
        action: started.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: "travelling",
            targetId: targetMsg.payload.targetId,
            occupiedCornerSteps,
            walker: started.state,
          },
        },
      };
    }

    // Travelling towards winner corner
    if (state.phase === "travelling") {
      const result = FaultyBoundaryTraversal.advance(observation, state.walker);
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

    // Check for Timeout: Seekers have crashed!
    if (state.phase === "waiting" && round >= state.timeoutRound) {
      const livingIds = observation.coLocatedRobotIds.sort((a, b) => a - b);
      if (livingIds.length <= 1) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [MEMORY_KEY]: {
              role: "singleton-corner",
              phase: "arrived",
              cornerRobotIds: livingIds,
              knownMinimumId: livingIds[0],
            },
          },
        };
      }

      // Re-partition and re-launch seekers
      return this.initialize(observation, round);
    }

    return { action: { type: "stay" } };
  }

  computeSeeker(observation, inbox, previousState) {
    const state = structuredClone(previousState);

    // Target ready: travel to winner corner
    if (state.phase === "target-ready") {
      if (state.targetDistance === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: { [MEMORY_KEY]: { ...state, phase: "arrived" } },
        };
      }

      const started = FaultyBoundaryTraversal.start(
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
      const result = FaultyBoundaryTraversal.advance(observation, state.walker);
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

    // Advance along the perimeter tour
    const result = FaultyBoundaryTraversal.advance(observation, state.walker);
    state.walker = result.state;

    if (result.edgeCompleted) {
      state.steps += 1;
    }

    // At each corner visited along the tour, check IDs and stationary singleton corners
    if (result.edgeCompleted && observation.degree === 2) {
      const candidates = [...observation.coLocatedRobotIds];
      let isSingleton = false;
      for (const msg of inbox) {
        if (msg.payload?.type === "faulty-stage2-corner-info") {
          if (Array.isArray(msg.payload.cornerRobotIds)) {
            candidates.push(...msg.payload.cornerRobotIds);
            if (msg.payload.cornerRobotIds.length === 1) isSingleton = true;
          }
          if (Number.isInteger(msg.payload.minimumId)) {
            candidates.push(msg.payload.minimumId);
          }
        }
      }

      if (state.steps > 0 && (observation.coLocatedRobotIds.length === 1 || isSingleton)) {
        state.occupiedCornerSteps ??= [];
        if (!state.occupiedCornerSteps.includes(state.steps)) {
          state.occupiedCornerSteps.push(state.steps);
        }
      }

      if (candidates.length > 0) {
        const candidateMin = Math.min(...candidates);
        if (candidateMin < state.minimumId) {
          state.minimumId = candidateMin;
          state.targetOffset = state.steps;
        }
      }
    }

    // Full tour completed!
    if (state.steps >= this.perimeterEdges) {
      const forwardDistance = state.targetOffset;
      const backwardDistance = this.perimeterEdges - forwardDistance;
      const useForward = forwardDistance <= backwardDistance;

      state.targetDistance = useForward ? forwardDistance : backwardDistance;
      state.targetPort = useForward ? state.startPort : state.reversePort;
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
