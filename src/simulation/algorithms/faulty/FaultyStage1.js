import { FaultyStraightLineNavigation } from "./navigation/FaultyStraightLineNavigation.js";
import { FaultyBoundaryTraversal } from "./navigation/FaultyBoundaryTraversal.js";

const STATUS_KEY = "faultyStage1";
const BOUNDARY_KEY = "faultyBoundaryNav";

/**
 * Stage 1 (Faulty): Move non-singleton groups and boundary robots to grid corners.
 * Internal singletons remain settled at their nodes.
 *
 * Fault tolerance:
 * - Uses ⌊t/2⌋ scouts and ⌈t/2⌉ waiting base for straight-line movement.
 * - Scout crashes are caught via 56-round timeouts by the waiting base.
 * - Boundary robots move independently towards degree-2 corners.
 */
export class FaultyStage1 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Faulty Stage 1 requires a square grid size of at least 2.");
    }

    this.size = size;
    this.straightLineNav = new FaultyStraightLineNavigation({ size });
  }

  createMessage(observation, round) {
    if (observation.degree === 4) {
      return this.straightLineNav.createMessage(observation, round);
    }
    return null;
  }

  compute(observation, inbox, round) {
    const memory = observation.memory;

    // Corner reached (degree 2): remain at corner
    if (observation.degree === 2) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [STATUS_KEY]: { status: "at-corner" },
          faultyStraightLineNavigation: { phase: "idle" },
        },
      };
    }

    // Boundary node (degree 3): move towards corner
    if (observation.degree === 3) {
      const boundaryState = memory[BOUNDARY_KEY];
      if (!boundaryState) {
        // Start moving along boundary from lowest port
        const port = Math.min(...observation.ports);
        const started = FaultyBoundaryTraversal.start(observation, port);
        return {
          action: started.action,
          memoryUpdates: {
            [STATUS_KEY]: { status: "moving-boundary" },
            [BOUNDARY_KEY]: started.state,
          },
        };
      }

      const step = FaultyBoundaryTraversal.advance(observation, boundaryState);
      const isCorner = observation.degree === 2 || step.state.phase === "arrived";
      return {
        action: isCorner ? { type: "stay" } : step.action,
        memoryUpdates: {
          [STATUS_KEY]: { status: isCorner ? "at-corner" : "moving-boundary" },
          [BOUNDARY_KEY]: step.state,
        },
      };
    }

    // Internal node (degree 4):
    if (observation.degree === 4) {
      // If robot was probing the boundary and stepped into interior, return back
      if (memory[BOUNDARY_KEY]?.pendingKind === "probe") {
        const step = FaultyBoundaryTraversal.advance(observation, memory[BOUNDARY_KEY]);
        return {
          action: step.action,
          memoryUpdates: {
            [STATUS_KEY]: { status: "moving-boundary" },
            [BOUNDARY_KEY]: step.state,
          },
        };
      }

      // Settled singleton check
      if (memory[STATUS_KEY]?.status === "settled-singleton") {
        return {
          action: { type: "stay" },
          memoryUpdates: { [STATUS_KEY]: { status: "settled-singleton" } },
        };
      }

      // If lone robot with no active search/probe state, settle as singleton
      const navPhase = memory.faultyStraightLineNavigation?.phase;
      const isAlone = observation.coLocatedRobotIds.length === 1;
      const hasActiveSearch = ["searching", "returning-home", "waiting"].includes(navPhase);

      if (isAlone && !hasActiveSearch) {
        return {
          action: { type: "stay" },
          memoryUpdates: {
            [STATUS_KEY]: { status: "settled-singleton" },
            faultyStraightLineNavigation: { phase: "singleton" },
          },
        };
      }

      // Execute straight-line navigation step
      const decision = this.straightLineNav.compute(observation, inbox, round);
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          [STATUS_KEY]: { status: "in-stage-1" },
        },
      };
    }

    return { action: { type: "stay" } };
  }
}
