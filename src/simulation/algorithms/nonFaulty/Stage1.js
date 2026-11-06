import { StraightLineNavigation } from "./navigation/StraightLineNavigation.js";
import { BoundaryNavigation } from "./navigation/BoundaryNavigation.js";

const STATUS_KEY = "nonFaultyStage1";

/** Moto: Move non-singleton groups and boundary robots to grid corners. */
export class Stage1 {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Stage 1 requires a square grid size of at least 2.");
    }

    this.straightLineNavigation = new StraightLineNavigation({ size });
  }

  createMessage(observation, round) {
    if (observation.degree === 4) {
      const boundaryMessage = BoundaryNavigation.createMessage(observation);
      if (boundaryMessage) return boundaryMessage;
    }

    if (observation.degree !== 4) return null;
    if (
      observation.memory[STATUS_KEY]?.status === "settled-singleton" &&
      !observation.memory.straightLineNavigation
    ) {
      return { type: "stage1-settled-singleton", robotId: observation.robotId };
    }
    if (
      observation.memory.straightLineNavigation?.phase === "waiting" &&
      Number.isInteger(observation.memory.incomingPort)
    ) {
      return {
        type: "stage1-line-waiting",
        backwardPort: observation.memory.incomingPort,
        lineStartedRound: observation.memory.straightLineNavigation.lineStartedRound,
      };
    }
    return this.straightLineNavigation.createMessage(observation, round);
  }

  compute(observation, inbox, round) {
    const navigationPhase =
      observation.memory.straightLineNavigation?.phase;

    if (observation.degree === 4) {
      const waitingMessages = inbox.filter(
        (message) => message.payload?.type === "stage1-line-waiting"
      );
      const expiredWait =
        ["waiting", "searching", "returning-home"].includes(navigationPhase) &&
        Number.isInteger(observation.memory.straightLineNavigation?.lineStartedRound) &&
        round - observation.memory.straightLineNavigation.lineStartedRound >=
          this.straightLineNavigation.maxLineRounds;
      const expiredPeerWait = waitingMessages.some(
        (message) => Number.isInteger(message.payload.lineStartedRound) &&
          round - message.payload.lineStartedRound >=
            this.straightLineNavigation.maxLineRounds
      );

      if (expiredWait || expiredPeerWait) {
        if (observation.coLocatedRobotIds.length === 1) {
          return {
            action: { type: "stay" },
            memoryUpdates: {
              straightLineNavigation: { phase: "singleton" },
              [STATUS_KEY]: { status: "settled-singleton" },
            },
          };
        }

        const restartSources = [
          ...waitingMessages,
          ...(navigationPhase === "waiting"
            ? [{
                fromRobotId: observation.robotId,
                payload: {
                  type: "stage1-line-waiting",
                  backwardPort: observation.memory.incomingPort,
                  lineStartedRound: observation.memory.straightLineNavigation.lineStartedRound,
                },
              }]
            : []),
        ].sort((first, second) => first.fromRobotId - second.fromRobotId);
        const restartSource = restartSources[0];

        if (Number.isInteger(restartSource?.payload?.backwardPort)) {
          const restartObservation = {
            ...observation,
            memory: {
              ...observation.memory,
              incomingPort: restartSource.payload.backwardPort,
            },
          };
          const decision = this.straightLineNavigation.startAtReference(
            restartObservation,
            round,
            round,
            { groupIds: observation.coLocatedRobotIds }
          );
          return {
            ...decision,
            memoryUpdates: {
              ...decision.memoryUpdates,
              [STATUS_KEY]: { status: "joined-moving-group" },
            },
          };
        }
      }
    }

    const lineDirection = inbox.find(
      (message) => message.payload?.type === "straight-line-direction"
    );
    if (
      observation.degree === 4 &&
      observation.memory[STATUS_KEY]?.status === "settled-singleton" &&
      lineDirection &&
      observation.ports.includes(lineDirection.payload.port)
    ) {
      return {
        action: { type: "move", port: lineDirection.payload.port },
        memoryUpdates: {
          straightLineNavigation: {
            phase: "idle",
            groupIds: [...new Set([
              ...(lineDirection.payload.groupIds ?? []),
              ...observation.coLocatedRobotIds,
            ])].sort((first, second) => first - second),
            lineStartedRound: lineDirection.payload.lineStartedRound ?? round,
          },
          [STATUS_KEY]: { status: "joined-moving-group" },
        },
      };
    }

    if (
      observation.degree === 4 &&
      observation.memory[STATUS_KEY]?.status === "settled-singleton" &&
      inbox.some((message) => message.payload?.type === "straight-line-arrival")
    ) {
      const decision = this.straightLineNavigation.joinAtReference(
        observation,
        inbox,
        round
      );
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          [STATUS_KEY]: { status: "joined-moving-group" },
        },
      };
    }

    const lineState = observation.memory.straightLineNavigation;
    if (
      observation.degree === 4 &&
      observation.coLocatedRobotIds.length > 1 &&
      inbox.some((message) => message.payload?.type === "stage1-settled-singleton") &&
      ["positioned", "idle"].includes(lineState?.phase) &&
      Number.isInteger(lineState.lineStartedRound) &&
      Number.isInteger(observation.memory.incomingPort)
    ) {
      const decision = this.straightLineNavigation.joinAtReference(
        observation,
        [{
          fromRobotId: observation.robotId,
          payload: {
            type: "straight-line-arrival",
            backwardPort: observation.memory.incomingPort,
            lineStartedRound: lineState.lineStartedRound,
          },
        }],
        round
      );
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          [STATUS_KEY]: { status: "joined-moving-group" },
        },
      };
    }

    const explorerReturnedToBoundary =
      ["searching", "returning-home"].includes(navigationPhase) &&
      observation.degree === 3 &&
      this.straightLineNavigation.isAtReferenceNode(observation);

    const explorerReturnedToCorner =
      ["searching", "returning-home"].includes(navigationPhase) &&
      observation.degree === 2 &&
      this.straightLineNavigation.isAtReferenceNode(observation);

    if (explorerReturnedToCorner) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [STATUS_KEY]: { status: "at-corner" },
          straightLineNavigation: { phase: "idle" },
        },
      };
    }

    if (explorerReturnedToBoundary) {
      const decision = BoundaryNavigation.compute(observation);
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          straightLineNavigation: { phase: "idle" },
        },
      };
    }

    const boundaryProbePresent = inbox.some(
      (message) => message.payload?.type === "boundary-interior-probe"
    );
    const isThisRobotBoundaryProbe =
      observation.memory.boundaryNavigation?.phase === "checking";
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

    if (["searching", "returning-home"].includes(navigationPhase)) {
      return this.straightLineNavigation.compute(observation, inbox, round);
    }

    if (observation.degree === 2) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [STATUS_KEY]: { status: "at-corner" },
          straightLineNavigation: { phase: "idle" },
        },
      };
    }

    // A boundary robot may temporarily enter an internal node to test whether
    // the chosen port follows the boundary. It must be routed back before the
    // ordinary internal-node singleton/group rules are applied.
    if (
      observation.degree === 4 &&
      observation.memory.boundaryNavigation?.phase === "checking"
    ) {
      return BoundaryNavigation.compute(observation);
    }

    if (observation.degree === 3) {
      const decision = BoundaryNavigation.compute(observation);
      return {
        ...decision,
        memoryUpdates: {
          ...decision.memoryUpdates,
          straightLineNavigation: { phase: "idle" },
        },
      };
    }

    if (observation.degree === 4) {
      const navigationIsActive = [
        "waiting",
        "searching",
        "returning-home",
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
