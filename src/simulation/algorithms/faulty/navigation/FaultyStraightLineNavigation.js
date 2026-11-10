import { FaultyRobotGroupHelper } from "../helpers/FaultyRobotGroupHelper.js";

const MEMORY_KEY = "faultyStraightLineNavigation";
const MAX_PATHS = 27;
const MAX_DEPTH = 3;
const ROUNDS_PER_PROBE = 56;

/**
 * Fault-tolerant straight-line navigation for internal groups (degree 4).
 *
 * Implements the halving scout protocol from Section 4 of Banerjee et al.:
 * - A group of t robots partitions into:
 *   - ⌊t/2⌋ highest-ID robots (scouts)
 *   - ⌈t/2⌉ lowest-ID robots (waiting base)
 * - Scouts explore up to 27 paths (56 rounds) to identify the 180° straight port.
 * - If at least ONE scout survives and reports the port, all surviving robots advance.
 * - If ALL scouts crash (detected by waiting base via 56-round timeout):
 *   the waiting robots re-partition into new halves and retry (at most log n retries).
 * - If waiting robots crash, returning scouts detect absence and advance independently.
 */
export class FaultyStraightLineNavigation {
  constructor({ size }) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Faulty straight-line navigation requires a square grid size of at least 2.");
    }

    this.size = size;
    this.maxLineRounds = ROUNDS_PER_PROBE * (size + Math.ceil(Math.log2(size * size)));
  }

  createMessage(observation, round) {
    const state = observation.memory[MEMORY_KEY];
    if (!state) return null;

    // A scout that has discovered the straight port broadcasts it to the waiting base
    if (state.role === "scout" && ["searching", "returning-home"].includes(state.phase)) {
      if (this.isAtReference(observation, state)) {
        const returnPorts = this.getReturnPorts(observation, state);
        if (returnPorts.length === 2) {
          const straightPort = this.getStraightPort(observation, state, returnPorts);
          return {
            type: "faulty-straight-direction",
            port: straightPort,
            scoutIds: state.scoutIds,
            waitingIds: state.waitingIds,
            round,
          };
        }
      }
    }

    // A waiting robot advertises its waiting state so late-joining peers know the reference
    if (state.role === "waiting" && Number.isInteger(observation.memory.incomingPort)) {
      return {
        type: "stage1-faulty-waiting",
        backwardPort: observation.memory.incomingPort,
        timeoutRound: state.timeoutRound,
        startRound: state.startRound,
      };
    }

    return null;
  }

  compute(observation, inbox, round) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) return this.start(observation, round);

    switch (state.phase) {
      case "positioned":
        return this.partitionAtReference(observation, round, state.startRound, state);
      case "waiting":
        return this.computeWaiting(observation, inbox, state, round);
      case "searching":
      case "returning-home":
        return this.computeScout(observation, inbox, state);
      case "idle":
        return this.partitionAtReference(observation, round, round, state);
      case "boundary":
      case "singleton":
        return this.stay(state);
      default:
        return this.stay(state);
    }
  }

  start(observation, round) {
    if (observation.degree !== 4) {
      return this.stay({ phase: "boundary" });
    }

    if (observation.coLocatedRobotIds.length < 2) {
      return this.stay({ phase: "singleton" });
    }

    // Initial step: group moves through port 1 together
    if (observation.memory.incomingPort === undefined) {
      const initialPort = observation.ports.includes(1) ? 1 : Math.min(...observation.ports);
      return this.move(initialPort, {
        phase: "positioned",
        groupIds: [...observation.coLocatedRobotIds],
        startRound: round,
      });
    }

    return this.partitionAtReference(observation, round, round);
  }

  partitionAtReference(observation, round, startRound = round, previousState = null) {
    if (observation.degree !== 4) return this.stay({ phase: "boundary" });

    const livingGroup = observation.coLocatedRobotIds.filter((id) =>
      previousState?.groupIds ? previousState.groupIds.includes(id) || id === observation.robotId : true
    );
    const sortedIds = [...new Set(livingGroup.length > 0 ? livingGroup : observation.coLocatedRobotIds)].sort((a, b) => a - b);

    if (sortedIds.length < 2) {
      return this.stay({ phase: "singleton" });
    }

    const { waitingIds, scoutIds } = FaultyRobotGroupHelper.splitGroup(sortedIds);
    const backwardPort = observation.memory.incomingPort;

    if (backwardPort === undefined) {
      throw new Error("Faulty straight-line exploration needs an incoming backward port.");
    }

    const isScout = scoutIds.includes(observation.robotId);
    const timeoutRound = round + ROUNDS_PER_PROBE;

    if (!isScout) {
      // Waiting base robot
      return this.stay({
        role: "waiting",
        phase: "waiting",
        scoutIds,
        waitingIds,
        groupIds: sortedIds,
        backwardPort,
        startRound,
        timeoutRound,
      });
    }

    // Scout robot: start depth-three probe
    const firstProbePort = observation.ports
      .filter((port) => port !== backwardPort)
      .sort((a, b) => a - b)[0];

    if (firstProbePort === undefined) {
      throw new Error("No probe port remains after excluding backward port.");
    }

    return this.move(firstProbePort, {
      role: "scout",
      phase: "searching",
      scoutIds,
      waitingIds,
      groupIds: sortedIds,
      backwardPort,
      startRound,
      timeoutRound,
      frames: [],
      returnPorts: [],
      probedPorts: [firstProbePort],
      exploredPaths: 0,
    });
  }

  computeWaiting(observation, inbox, state, round) {
    // 1. Check if ANY scout reported the straight port
    const directionMsg = inbox.find((item) =>
      item.payload?.type === "faulty-straight-direction" &&
      state.scoutIds.includes(item.fromRobotId)
    );

    if (directionMsg) {
      const port = directionMsg.payload.port;
      if (!observation.ports.includes(port)) {
        throw new Error(`Scout supplied invalid straight port ${port}.`);
      }

      return this.move(port, {
        phase: "idle",
        groupIds: state.groupIds,
        startRound: state.startRound,
      });
    }

    // 2. Check for Timeout: Have all scouts crashed?
    if (round >= state.timeoutRound) {
      // The scouts have crashed! Filter living peers of this moving group
      const survivingIds = observation.coLocatedRobotIds
        .filter((id) => state.groupIds?.includes(id))
        .sort((a, b) => a - b);

      if (survivingIds.length <= 1) {
        return this.stay({
          phase: "singleton",
          status: "settled-singleton",
        });
      }

      // Re-partition the survivors and restart exploration
      return this.partitionAtReference(observation, round, round);
    }

    // Continue waiting
    return this.stay(state);
  }

  computeScout(observation, inbox, previousState) {
    const state = structuredClone(previousState);

    // If scout returned to reference node
    if (this.isAtReference(observation, state)) {
      const incomingPort = observation.memory.incomingPort;
      if (incomingPort !== undefined) {
        state.returnPorts = [...new Set([...state.returnPorts, incomingPort])];
      }

      if (state.returnPorts.length === 2) {
        const straightPort = this.getStraightPort(observation, state, state.returnPorts);

        return this.move(straightPort, {
          phase: "idle",
          groupIds: [...new Set(state.groupIds ?? observation.coLocatedRobotIds)],
          startRound: state.startRound,
        });
      }

      // If probe returned home with 1 return port and needs next port
      if (
        state.returnPorts.length === 1 &&
        (state.phase === "returning-home" || state.frames.length === 0)
      ) {
        const probedPorts = state.probedPorts ?? [];
        const nextProbePort = observation.ports
          .filter((port) => port !== state.backwardPort && !probedPorts.includes(port))
          .sort((a, b) => a - b)[0];

        if (nextProbePort !== undefined) {
          return this.move(nextProbePort, {
            ...state,
            phase: "searching",
            frames: [],
            probedPorts: [...probedPorts, nextProbePort],
            exploredPaths: 0,
          });
        }
      }

      if (state.phase === "returning-home" || state.frames.length === 0) {
        // Fallback: If 2 return ports not found in 4 hops, pick opposite port
        const oppPort = observation.ports.find((p) => p !== state.backwardPort) ?? observation.ports[0];
        return this.move(oppPort, {
          phase: "idle",
          groupIds: state.groupIds,
          startRound: state.startRound,
        });
      }

      state.exploredPaths += 1;
      state.frames.pop();
      return this.move(incomingPort, state);
    }

    if (state.phase === "returning-home") {
      const returnPort = observation.memory.incomingPort;
      if (!Number.isInteger(returnPort)) {
        throw new Error("Scout has no incoming port to continue returning home.");
      }
      return this.move(returnPort, state);
    }

    // Standard Depth-3 DFS
    if (state.frames.length === 0) {
      const incomingPort = observation.memory.incomingPort;
      if (incomingPort === undefined) {
        throw new Error("Scout has no return port at the first DFS node.");
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

    if (state.exploredPaths >= MAX_PATHS || frame.depth >= MAX_DEPTH) {
      state.exploredPaths += 1;
      return this.backtrack(observation, state);
    }

    if (!frame.initialized) {
      const incomingPort = observation.memory.incomingPort;
      frame.remainingPorts = observation.ports
        .filter((port) => port !== incomingPort)
        .sort((a, b) => a - b);
      frame.initialized = true;
    }

    if (frame.remainingPorts.length === 0) {
      return this.backtrack(observation, state);
    }

    const nextPort = frame.remainingPorts.shift();
    state.frames.push({
      depth: frame.depth + 1,
      parentPort: null,
      initialized: false,
      remainingPorts: [],
    });
    return this.move(nextPort, state);
  }

  backtrack(observation, state) {
    const completedFrame = state.frames.pop();
    if (!Number.isInteger(completedFrame?.parentPort)) {
      throw new Error("Scout DFS frame has no parent port.");
    }

    if (state.frames.length === 0) {
      state.phase = "returning-home";
    }

    return this.move(completedFrame.parentPort, state);
  }

  isAtReference(observation, state) {
    // Check if co-located with any of the waiting base robots
    return state.waitingIds.some((id) => observation.coLocatedRobotIds.includes(id));
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
      const other = returnPorts.find((port) => port !== state.backwardPort);
      if (other !== undefined) return other;
    }

    const remainingPorts = observation.ports.filter(
      (port) => port !== state.backwardPort && !returnPorts.includes(port)
    );
    if (remainingPorts.length === 1) {
      return remainingPorts[0];
    }

    return observation.ports.find((p) => p !== state.backwardPort) ?? observation.ports[0];
  }

  move(port, state) {
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
