const MEMORY_KEY = "straightLineNavigation";
const MAX_DEPTH = 3;

export class StraightLineNavigation {
  createMessage(observation, round) {
    const state = observation.memory[MEMORY_KEY];

    if (!state || state.phase !== "ready") {
      return null;
    }

    return {
      type: "straight-line-direction",
      explorerId: observation.robotId,
      port: state.straightPort,
    };
  }

  compute(observation, inbox, round) {
    const state = observation.memory[MEMORY_KEY];

    if (!state) {
      return this.start(observation);
    }

    switch (state.phase) {
      case "waiting":
        return this.waitForDirection(observation, inbox, state);

      case "searching":
        return this.search(observation, state);

      case "returning":
        return this.determineDirection(observation, state);

      case "ready":
        return this.moveStraight(observation, state);

      case "idle":
        return this.start(observation);

      case "boundary":
      case "singleton":
        return this.stay(state);

      default:
        throw new Error(
          `Unknown straight-line navigation phase: ${state.phase}`
        );
    }
  }

  start(observation) {
    // Straight-line navigation is only needed for groups
    // located at internal nodes.
    if (observation.degree !== 4) {
      return this.stay({ phase: "boundary" });
    }

    const robotIds = observation.coLocatedRobotIds;

    if (robotIds.length === 1) {
      return this.stay({ phase: "singleton" });
    }

    const explorerId = Math.max(...robotIds);
    const referenceIds = robotIds.filter(
      (id) => id !== explorerId
    );

    // Only the highest-ID robot explores.
    if (observation.robotId !== explorerId) {
      return this.stay({
        phase: "waiting",
        explorerId,
        referenceIds,
      });
    }

    // The explorer takes the minimum local port.
    if (!observation.ports.includes(1)) {
      throw new Error("Port 1 is unavailable at an internal node.");
    }

    return this.move(1, {
      phase: "searching",
      explorerId,
      referenceIds,
      frames: [],
      returnPorts: [],
      rootBackPort: null,
    });
  }

  search(observation, previousState) {
    const state = structuredClone(previousState);

    // First arrival at the exploration starting node.
    // Preserve the port leading back to the reference node.
    if (state.rootBackPort === null) {
      const incomingPort = observation.memory.incomingPort;

      if (incomingPort === undefined) {
        throw new Error(
          "Explorer has no incoming port at the DFS starting node."
        );
      }

      state.rootBackPort = incomingPort;

      state.frames.push({
        depth: 0,
        initialized: false,
        remainingPorts: [],
      });
    }

    const frames = state.frames;
    const currentFrame = frames[frames.length - 1];

    // The explorer has reached the reference node.
    // Record the local port at the reference node that
    // leads back to the explorer's previous position.
    const reachedReference = state.referenceIds.some(
      (id) => observation.coLocatedRobotIds.includes(id)
    );

    if (reachedReference) {
      const returnPort = observation.memory.incomingPort;

      if (returnPort === undefined) {
        throw new Error(
          "Cannot identify the return port at the reference node."
        );
      }

      if (!state.returnPorts.includes(returnPort)) {
        state.returnPorts.push(returnPort);
      }

      return this.backtrack(observation, state);
    }

    // A path of length three has been fully explored.
    if (currentFrame.depth >= MAX_DEPTH) {
      return this.backtrack(observation, state);
    }

    // Initialize this DFS node's unexplored ports.
    // Never immediately traverse the edge we arrived through.
    if (!currentFrame.initialized) {
      const incomingPort = observation.memory.incomingPort;

      currentFrame.remainingPorts = observation.ports
        .filter((port) => port !== incomingPort)
        .sort((a, b) => a - b);

      currentFrame.initialized = true;
    }

    // All ports at this node have been explored.
    if (currentFrame.remainingPorts.length === 0) {
      return this.backtrack(observation, state);
    }

    // Explore the smallest remaining local port first.
    const nextPort = currentFrame.remainingPorts.shift();

    // Push the child onto the DFS stack.
    state.frames.push({
      depth: currentFrame.depth + 1,
      initialized: false,
      remainingPorts: [],
    });

    return this.move(nextPort, state);
  }

  backtrack(observation, state) {
    const incomingPort = observation.memory.incomingPort;

    if (incomingPort === undefined) {
      throw new Error("DFS cannot backtrack without an incoming port.");
    }

    // Remove the current DFS frame.
    state.frames.pop();

    // If the root frame has been exhausted, the explorer
    // is back at its DFS starting node.
    if (state.frames.length === 0) {
      if (state.rootBackPort === null) {
        throw new Error("DFS starting port was not recorded.");
      }

      state.phase = "returning";

      // Return to the reference robot.
      return this.move(state.rootBackPort, state);
    }

    // Return to the parent DFS node.
    return this.move(incomingPort, state);
  }

  determineDirection(observation, previousState) {
    const state = structuredClone(previousState);

    const referencePresent = state.referenceIds.some(
      (id) => observation.coLocatedRobotIds.includes(id)
    );

    if (!referencePresent) {
      throw new Error(
        "Explorer returned to a node without the reference group."
      );
    }

    const returnPorts = [...new Set(state.returnPorts)];
    const backwardPort = observation.memory.incomingPort;

    if (returnPorts.length !== 2) {
      throw new Error(
        `Expected exactly two return paths, found ${returnPorts.length}. ` +
        "The reference node may be too close to the grid boundary."
      );
    }

    if (backwardPort === undefined) {
      throw new Error("Cannot identify the backward port.");
    }

    let straightPort;

    // Case 1: One return port is the backward port.
    // The other return port gives the straight direction.
    if (returnPorts.includes(backwardPort)) {
      straightPort = returnPorts.find(
        (port) => port !== backwardPort
      );
    } else {
      // Case 2: Neither return port is the backward port.
      // The remaining port, excluding the backward port,
      // is the straight direction.
      const remainingPorts = observation.ports.filter(
        (port) =>
          port !== backwardPort &&
          !returnPorts.includes(port)
      );

      if (remainingPorts.length !== 1) {
        throw new Error(
          "Could not uniquely determine the straight direction."
        );
      }

      straightPort = remainingPorts[0];
    }

    state.phase = "ready";
    state.straightPort = straightPort;

    return this.stay(state);
  }

  waitForDirection(observation, inbox, state) {
    const message = inbox.find(
      (item) =>
        item.fromRobotId === state.explorerId &&
        item.payload?.type === "straight-line-direction"
    );

    if (!message) {
      return this.stay(state);
    }

    const port = message.payload.port;

    if (!observation.ports.includes(port)) {
      throw new Error(
        `Explorer supplied invalid straight port ${port}.`
      );
    }

    // All waiting robots move through the same local port.
    return this.move(port, { phase: "idle" });
  }

  moveStraight(observation, state) {
    const port = state.straightPort;

    if (!observation.ports.includes(port)) {
      throw new Error(
        `Invalid straight port ${port} for robot ${observation.robotId}.`
      );
    }

    return this.move(port, { phase: "idle" });
  }

  move(port, state) {
    return {
      action: {
        type: "move",
        port,
      },
      memoryUpdates: {
        [MEMORY_KEY]: state,
      },
    };
  }

  stay(state) {
    return {
      action: {
        type: "stay",
      },
      memoryUpdates: {
        [MEMORY_KEY]: state,
      },
    };
  }

  static getStatus(observation) {
    return observation.memory[MEMORY_KEY]?.phase ?? null;
  }
}
