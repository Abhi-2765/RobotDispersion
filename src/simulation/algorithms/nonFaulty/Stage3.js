const MEMORY_KEY = "nonFaultyStage3";
const MARKER_KEY = "nonFaultyStage3Marker";

export class Stage3 {
  createMessage(observation) {
    const marker = observation.memory[MARKER_KEY];
    if (marker) {
      return { type: "stage3-marker", marker };
    }

    const state = observation.memory[MEMORY_KEY];
    if (state?.pendingMarkerInit) {
      return {
        type: "stage3-init-marker",
        marker: state.pendingMarkerInit,
      };
    }

    if (this.isPreviouslySettled(observation)) {
      return {
        type: "stage3-existing-singleton",
        robotId: observation.robotId,
      };
    }

    return null;
  }

  compute(observation, inbox) {
    const initMessage = inbox.find(
      (message) => message.payload?.type === "stage3-init-marker"
    );

    // An initially settled singleton can become a DFS node marker when the
    // moving group first visits it. Its location and ID are never exposed.
    if (
      initMessage &&
      observation.memory[MARKER_KEY]?.visited !== true &&
      !observation.memory[MEMORY_KEY]
    ) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MARKER_KEY]: initMessage.payload.marker,
        },
      };
    }

    if (observation.memory[MARKER_KEY]) {
      return { action: { type: "stay" } };
    }

    const state = observation.memory[MEMORY_KEY];
    if (!state) return this.initialize(observation, inbox);

    if (state.role !== "active") {
      return { action: { type: "stay" } };
    }

    if (state.phase === "arrived-child") {
      return this.handleChildArrival(observation, inbox, state);
    }

    if (state.phase === "initialize-existing-marker") {
      const nextState = { ...state, phase: "at-node", pendingMarkerInit: null };
      return this.exploreFromCurrentNode(observation, nextState);
    }

    if (state.phase === "at-node") {
      return this.exploreFromCurrentNode(observation, state);
    }

    return { action: { type: "stay" } };
  }

  isPreviouslySettled(observation) {
    return (
      observation.memory.nonFaultyStage1?.status === "settled-singleton" ||
      observation.memory.nonFaultyStage2?.role === "singleton-corner"
    );
  }

  initialize(observation, inbox) {
    // Robots that were singletons before Stage 3 stay where they are. They
    // become unvisited markers so the first DFS visit can still explore
    // through their node rather than incorrectly treating it as already seen.
    if (this.isPreviouslySettled(observation)) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MARKER_KEY]: {
            visited: false,
            parentPort: null,
            preexistingSingleton: true,
          },
        },
      };
    }

    if (observation.degree !== 2) {
      return { action: { type: "stay" } };
    }

    const existingSingletonIds = new Set(
      inbox
        .filter((message) => message.payload?.type === "stage3-existing-singleton")
        .map((message) => message.payload.robotId)
    );
    const groupIds = observation.coLocatedRobotIds
      .filter((id) => !existingSingletonIds.has(id))
      .sort((a, b) => a - b);

    // A lone robot at a corner, with no previously settled robot beside it,
    // is already dispersed and must not start a pointless exploration.
    if (groupIds.length <= 1 && existingSingletonIds.size === 0) {
      return { action: { type: "stay" } };
    }

    const hasExistingRootMarker = existingSingletonIds.size > 0;
    // If a previously settled robot already occupies the root, every robot
    // in the arriving group must be mobile; leaving an additional robot at
    // the root would create a permanent collision.
    const rootMarkerId = hasExistingRootMarker ? null : groupIds[0];
    const activeIds = rootMarkerId === null
      ? groupIds
      : groupIds.filter((id) => id !== rootMarkerId);
    const rootMarker = {
      visited: true,
      parentPort: null,
      createdByStage3: true,
    };
    const rootFrame = {
      parentPort: null,
      remainingPorts: [...observation.ports].sort((a, b) => a - b),
    };

    if (rootMarkerId !== null && observation.robotId === rootMarkerId) {
      return {
        action: { type: "stay" },
        memoryUpdates: { [MARKER_KEY]: rootMarker },
      };
    }

    if (activeIds.includes(observation.robotId)) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "active",
            phase: "at-node",
            activeIds,
            frames: [rootFrame],
            pendingMarkerInit: hasExistingRootMarker
              ? {
                  visited: true,
                  parentPort: null,
                  createdByStage3: true,
                }
              : null,
          },
        },
      };
    }

    return { action: { type: "stay" } };
  }

  handleChildArrival(observation, inbox, previousState) {
    const state = structuredClone(previousState);
    const activeIds = state.activeIds;
    const foreignIds = observation.coLocatedRobotIds.filter(
      (id) => !activeIds.includes(id)
    );
    const knownMarker = inbox.some(
      (message) =>
        foreignIds.includes(message.fromRobotId) &&
        message.payload?.type === "stage3-marker" &&
        message.payload.marker?.visited === true
    );

    if (knownMarker) {
      const returnPort = observation.memory.incomingPort;
      if (returnPort === undefined) {
        throw new Error("DFS reached a visited node without an incoming port.");
      }

      return {
        action: { type: "move", port: returnPort },
        memoryUpdates: {
          [MEMORY_KEY]: { ...state, phase: "at-node" },
        },
      };
    }

    if (foreignIds.length > 0) {
      // This is an initially occupied singleton node, not yet visited by the
      // Stage-3 DFS. Initialize its resident robot as a marker, then continue.
      const marker = {
        visited: true,
        parentPort: observation.memory.incomingPort,
        createdByStage3: true,
      };
      const frame = {
        parentPort: observation.memory.incomingPort,
        remainingPorts: observation.ports
          .filter((port) => port !== observation.memory.incomingPort)
          .sort((a, b) => a - b),
      };

      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            phase: "initialize-existing-marker",
            pendingMarkerInit: marker,
            frames: [...state.frames, frame],
          },
        },
      };
    }

    // The node was empty. Leave one robot there as its permanent marker and
    // let the remaining robots continue the DFS together.
    const markerId = Math.min(...activeIds);
    const remainingIds = activeIds.filter((id) => id !== markerId);
    const marker = {
      visited: true,
      parentPort: observation.memory.incomingPort,
      createdByStage3: true,
    };
    const frame = {
      parentPort: observation.memory.incomingPort,
      remainingPorts: observation.ports
        .filter((port) => port !== observation.memory.incomingPort)
        .sort((a, b) => a - b),
    };

    if (observation.robotId === markerId) {
      return {
        action: { type: "stay" },
        memoryUpdates: { [MARKER_KEY]: marker },
      };
    }

    return {
      action: { type: "stay" },
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          phase: "at-node",
          activeIds: remainingIds,
          frames: [...state.frames, frame],
          pendingMarkerInit: null,
        },
      },
    };
  }

  exploreFromCurrentNode(observation, previousState) {
    const state = structuredClone(previousState);
    const frame = state.frames[state.frames.length - 1];

    if (!frame) {
      throw new Error("Stage 3 DFS stack became empty unexpectedly.");
    }

    if (frame.remainingPorts.length > 0) {
      const port = frame.remainingPorts.shift();
      return {
        action: { type: "move", port },
        memoryUpdates: {
          [MEMORY_KEY]: { ...state, phase: "arrived-child" },
        },
      };
    }

    if (state.frames.length > 1) {
      const completedFrame = state.frames.pop();
      if (completedFrame.parentPort === null || completedFrame.parentPort === undefined) {
        throw new Error("Stage 3 cannot backtrack from a non-root DFS frame.");
      }

      return {
        action: { type: "move", port: completedFrame.parentPort },
        memoryUpdates: {
          [MEMORY_KEY]: { ...state, phase: "at-node" },
        },
      };
    }

    if (state.activeIds.length === 1) {
      // This can only occur if the grid has no remaining empty node, which
      // should be impossible when k <= n and all initial singletons are kept.
      throw new Error(
        "Stage 3 exhausted the grid while a robot remained unsettled; check the initial robot count."
      );
    }

    return { action: { type: "stay" } };
  }
}
