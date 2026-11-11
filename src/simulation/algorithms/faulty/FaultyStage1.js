import { FaultyStraightLineNavigation } from "./navigation/FaultyStraightLineNavigation.js";
import { BoundaryNavigation } from "../nonFaulty/navigation/BoundaryNavigation.js";

const STATUS_KEY = "faultyStage1";

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
      const boundaryMsg = BoundaryNavigation.createMessage(observation);
      if (boundaryMsg) return boundaryMsg;
      return this.straightLineNav.createMessage(observation, round);
    }
    return null;
  }

  compute(observation, inbox, round) {
    const memory = observation.memory;
    const navPhase = memory.faultyStraightLineNavigation?.phase;

    // Active scouts searching or returning home must continue straight-line probe
    if (["searching", "returning-home"].includes(navPhase)) {
      const decision = this.straightLineNav.compute(observation, inbox, round);
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          [STATUS_KEY]: { status: "in-stage-1" },
        },
      };
    }

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

    // A boundary robot temporarily probed an internal node (degree 4): return to boundary
    if (
      observation.degree === 4 &&
      memory.boundaryNavigation?.phase === "checking"
    ) {
      return BoundaryNavigation.compute(observation);
    }

    // Boundary node (degree 3): move towards corner
    if (observation.degree === 3) {
      const decision = BoundaryNavigation.compute(observation);
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          [STATUS_KEY]: { status: "moving-boundary" },
          faultyStraightLineNavigation: { phase: "idle" },
        },
      };
    }

    // Internal node (degree 4):
    if (observation.degree === 4) {

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
