const MEMORY_KEY = "straightLineNavigation";
const MAX_PATHS = 27;
const MAX_DEPTH = 3;
const ROUNDS_PER_GRID_EDGE = 56;

/**
 * Straight-line movement for a non-singleton internal group.
 *
 * The group moves X -> Y through port 1. At Y, the highest-ID robot moves
 * through the lowest port other than the backward port to Z, then searches
 * the depth-three port tree from Z while the rest of the group waits at Y.
 * It reports the inferred straight port after identifying two return
 * directions at Y.
 */
export class StraightLineNavigation {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Straight-line navigation requires a square grid size of at least 2.");
    }

    this.maxLineRounds = ROUNDS_PER_GRID_EDGE * size;
  }

  createMessage(observation) {
    const state = observation.memory[MEMORY_KEY];
    if (!state) return null;

    if (!["searching", "returning-home"].includes(state.phase)) return null;

    if (!this.isAtReference(observation, state)) return null;

    const returnPorts = this.getReturnPorts(observation, state);
    if (returnPorts.length !== 2) return null;

    return {
      type: "straight-line-direction",
      explorerId: observation.robotId,
      port: this.getStraightPort(observation, state, returnPorts),
      groupIds: state.groupIds,
      lineStartedRound: state.lineStartedRound,
    };
  }

  compute(observation, inbox, round) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) return this.start(observation, round);

    switch (state.phase) {
      case "positioned":
        return this.startAtReference(observation, round, state.lineStartedRound, state);
      case "waiting":
        return this.waitForDirection(observation, inbox, state, round);
      case "searching":
      case "returning-home":
        return this.search(observation, state, round);
      case "idle":
        return this.startAtReference(observation, round, state.lineStartedRound, state);
      case "boundary":
      case "singleton":
        return this.stay(state);
      default:
        throw new Error(`Unknown straight-line phase: ${state.phase}`);
    }
  }

  start(observation, round) {
    if (observation.degree !== 4) {
      return this.stay({ phase: "boundary" });
    }

    if (observation.coLocatedRobotIds.length < 2) {
      return this.stay({ phase: "singleton" });
    }

    // At the initial internal group node there is no incoming edge to define
    // a backward port. Move the whole group through port 1 first. Once there,
    // each robot observes the reciprocal incoming port locally.
    if (observation.memory.incomingPort === undefined) {
      if (!observation.ports.includes(1)) {
        throw new Error("Port 1 is unavailable at an internal node.");
      }

      return this.move(
        1,
        {
          phase: "positioned",
          groupIds: [...observation.coLocatedRobotIds],
          lineStartedRound: round,
        },
        round
      );
    }

    return this.startAtReference(observation, round, round);
  }

  startAtReference(
    observation,
    round,
    lineStartedRound = round,
    previousState = null
  ) {
    if (observation.degree !== 4) return this.stay({ phase: "boundary" });

    const knownGroupIds = previousState?.groupIds ?? observation.coLocatedRobotIds;
    const robotIds = [...new Set([...knownGroupIds, observation.robotId])]
      .sort((a, b) => a - b);
    if (robotIds.length < 2) return this.stay({ phase: "singleton" });

    const explorerId = Math.max(...robotIds);
    const referenceIds = robotIds.filter((id) => id !== explorerId);
    const backwardPort = observation.memory.incomingPort;

    if (backwardPort === undefined) {
      throw new Error("Straight-line exploration needs an incoming backward port.");
    }

    if (observation.robotId !== explorerId) {
      return this.stay({
        phase: "waiting",
        explorerId,
        referenceIds,
        groupIds: robotIds,
        backwardPort,
        lineStartedRound,
      });
    }

    // The group used port 1 on X -> Y. At Y the explorer takes the lowest
    // available port other than the backward port; this starts the 27-path
    // probe from Z without immediately retracing the group move.
    const firstProbePort = observation.ports
      .filter((port) => port !== backwardPort)
      .sort((a, b) => a - b)[0];

    if (firstProbePort === undefined) {
      throw new Error("No probe port remains after excluding the backward port.");
    }

    return this.move(firstProbePort, {
      phase: "searching",
      explorerId,
      referenceIds,
      groupIds: robotIds,
      backwardPort,
      lineStartedRound,
      frames: [],
      returnPorts: [],
        probedPorts: [firstProbePort],
      exploredPaths: 0,
    }, round);
  }

  search(observation, previousState, round) {
    const state = structuredClone(previousState);
    this.assertWithinRoundBound(state, round);

    if (this.isAtReference(observation, state)) {
      const incomingPort = observation.memory.incomingPort;
      if (incomingPort === undefined) {
        throw new Error("Explorer reached its reference without an incoming port.");
      }

      state.returnPorts = [...new Set([...state.returnPorts, incomingPort])];

      if (state.returnPorts.length === 2) {
        const straightPort = this.getStraightPort(
          observation,
          state,
          state.returnPorts
        );
        return this.move(
          straightPort,
          {
            phase: "idle",
            groupIds: [...new Set(state.groupIds ?? observation.coLocatedRobotIds)],
            lineStartedRound: state.lineStartedRound,
          },
          round
        );
      }

      // A depth-three probe can finish without finding a second way back to
      // the reference node. Probe another local direction and keep the return
      // ports already observed; otherwise the explorer can arrive home with
      // an empty DFS stack and fail before the group ever moves.
      if (
        state.returnPorts.length === 1 &&
        (state.phase === "returning-home" || state.frames.length === 0)
      ) {
        const probedPorts = state.probedPorts ?? [];
        const nextProbePort = observation.ports
          .filter((port) =>
            port !== state.backwardPort && !probedPorts.includes(port)
          )
          .sort((first, second) => first - second)[0];

        if (nextProbePort !== undefined) {
          return this.move(nextProbePort, {
            ...state,
            phase: "searching",
            frames: [],
            probedPorts: [...probedPorts, nextProbePort],
            exploredPaths: 0,
          }, round);
        }
      }

      if (state.phase === "returning-home") {
        throw new Error(
          "Straight-line DFS ended without finding two distinct return ports."
        );
      }

      if (state.frames.length === 0) {
        throw new Error("Straight-line DFS returned without an active search frame.");
      }

      state.exploredPaths += 1;
      state.frames.pop(); // Drop the frame for the reference node.
      return this.move(incomingPort, state, round);
    }

    if (state.phase === "returning-home") {
      const returnPort = observation.memory.incomingPort;
      if (!Number.isInteger(returnPort)) {
        throw new Error("Explorer has no local port to continue returning home.");
      }

      return this.move(returnPort, state, round);
    }

    if (state.frames.length === 0) {
      const incomingPort = observation.memory.incomingPort;
      if (incomingPort === undefined) {
        throw new Error("Explorer has no return port at the first DFS node.");
      }

      state.frames.push({
        depth: 0,
        parentPort: incomingPort,
        initialized: false,
        remainingPorts: [],
      });
    }

    const frame = state.frames[state.frames.length - 1];
    if (frame.parentPort === null) {
      frame.parentPort = observation.memory.incomingPort;
    }

    if (state.exploredPaths >= MAX_PATHS) {
      return this.backtrack(observation, state, round);
    }

    if (frame.depth >= MAX_DEPTH) {
      state.exploredPaths += 1;
      return this.backtrack(observation, state, round);
    }

    if (!frame.initialized) {
      const incomingPort = observation.memory.incomingPort;
      frame.remainingPorts = observation.ports
        .filter((port) => port !== incomingPort)
        .sort((a, b) => a - b);
      frame.initialized = true;
    }

    if (frame.remainingPorts.length === 0) {
      return this.backtrack(observation, state, round);
    }

    const nextPort = frame.remainingPorts.shift();
    state.frames.push({
      depth: frame.depth + 1,
      parentPort: null,
      initialized: false,
      remainingPorts: [],
    });
    return this.move(nextPort, state, round);
  }

  backtrack(observation, state, round) {
    const completedFrame = state.frames.pop();
    if (!Number.isInteger(completedFrame?.parentPort)) {
      throw new Error("Straight-line DFS frame has no parent port.");
    }

    if (state.frames.length === 0) {
      state.phase = "returning-home";
    }

    return this.move(completedFrame.parentPort, state, round);
  }

  isAtReference(observation, state) {
    return state.referenceIds.some((id) =>
      observation.coLocatedRobotIds.includes(id)
    );
  }

  isAtReferenceNode(observation) {
    const state = observation.memory[MEMORY_KEY];
    return Boolean(state && this.isAtReference(observation, state));
  }

  getReturnPorts(observation, state) {
    const incomingPort = observation.memory.incomingPort;
    return [
      ...new Set(
        incomingPort === undefined
          ? state.returnPorts
          : [...state.returnPorts, incomingPort]
      ),
    ];
  }

  getStraightPort(observation, state, returnPorts) {
    if (returnPorts.includes(state.backwardPort)) {
      return returnPorts.find((port) => port !== state.backwardPort);
    }

    const remainingPorts = observation.ports.filter(
      (port) => port !== state.backwardPort && !returnPorts.includes(port)
    );
    if (remainingPorts.length !== 1) {
      throw new Error("Could not uniquely infer the straight port.");
    }

    return remainingPorts[0];
  }

  waitForDirection(observation, inbox, state, round) {
    const message = inbox.find(
      (item) =>
        item.fromRobotId === state.explorerId &&
        item.payload?.type === "straight-line-direction"
    );

    if (!message) return this.stay(state);

    if (!observation.ports.includes(message.payload.port)) {
      throw new Error(`Explorer supplied invalid straight port ${message.payload.port}.`);
    }

    this.assertWithinRoundBound(state, round);
    return this.move(
      message.payload.port,
      {
        phase: "idle",
        groupIds: state.groupIds,
        lineStartedRound: state.lineStartedRound,
      },
      round
    );
  }

  assertWithinRoundBound(state, round) {
    if (round - state.lineStartedRound + 1 > this.maxLineRounds) {
      throw new Error(
        `Straight-line movement exceeded its ${this.maxLineRounds}-round grid-line bound.`
      );
    }
  }

  move(port, state, round) {
    if (state.lineStartedRound !== undefined) {
      this.assertWithinRoundBound(state, round);
    }

    return {
      action: { type: "move", port },
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }

  stay(state) {
    return {
      action: { type: "stay" },
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }
}
