import { StraightLineNavigation } from "./navigation/StraightLineNavigation.js";
import { BoundaryNavigation } from "./navigation/BoundaryNavigation.js";

const STATUS_KEY = "nonFaultyStage1";

/** Stage 1: move non-singleton groups and boundary robots to grid corners. */
export class Stage1 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Stage 1 requires a square grid size of at least 2.");
    }

    this.size = size;
    this.straightLineNavigation = new StraightLineNavigation();
  }

  createMessage(observation, round) {
    if (observation.degree === 4) {
      const boundaryMessage = BoundaryNavigation.createMessage(observation);
      if (boundaryMessage) return boundaryMessage;
    }

    if (observation.degree !== 4) return null;
    return this.straightLineNavigation.createMessage(observation, round);
  }

  compute(observation, inbox, round) {
    const navigationPhase =
      observation.memory.straightLineNavigation?.phase;

    // A boundary robot may briefly probe an internal node occupied by a
    // singleton or by another moving group. Those robots must not interpret
    // the temporary visit as a new group: the probe robot returns next round.
    const boundaryProbePresent = inbox.some(
      (message) => message.payload?.type === "boundary-interior-probe"
    );
    const isThisRobotBoundaryProbe =
      observation.memory.boundaryNavigation?.phase === "probe";
    if (
      observation.degree === 4 &&
      boundaryProbePresent &&
      !isThisRobotBoundaryProbe
    ) {
      return {
        action: { type: "stay" },
        memoryUpdates: { [STATUS_KEY]: { status: "waiting-for-boundary-probe" } },
      };
    }

    // The DFS probe may temporarily visit boundary and corner nodes. Those
    // visits are part of its bounded path enumeration, not Stage 1 arrival.
    if (["searching", "returning"].includes(navigationPhase)) {
      return this.straightLineNavigation.compute(observation, inbox, round);
    }

    if (observation.degree === 2) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [STATUS_KEY]: { status: "at-corner" },
        },
      };
    }

    // A boundary robot may temporarily enter an internal node to test whether
    // the chosen port follows the boundary. It must be routed back before the
    // ordinary internal-node singleton/group rules are applied.
    if (
      observation.degree === 4 &&
      observation.memory.boundaryNavigation?.phase === "probe"
    ) {
      return BoundaryNavigation.compute(observation);
    }

    if (observation.degree === 3) {
      return BoundaryNavigation.compute(observation);
    }

    if (observation.degree === 4) {
      const navigationIsActive = [
        "after-initial-hop",
        "waiting",
        "searching",
        "returning",
        "ready",
        "idle",
      ].includes(navigationPhase);

      // An explorer is often alone while performing its DFS, and the single
      // reference robot may also be alone while waiting. Continue their saved
      // protocol before applying the ordinary singleton rule.
      if (navigationIsActive || observation.coLocatedRobotIds.length > 1) {
        return this.straightLineNavigation.compute(observation, inbox, round);
      }

      return {
        action: { type: "stay" },
        memoryUpdates: {
          [STATUS_KEY]: { status: "settled-singleton" },
        },
      };
    }

    throw new Error(`Stage 1 encountered unsupported node degree ${observation.degree}.`);
  }
}
