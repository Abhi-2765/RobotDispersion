const KEY = "boundaryNavigation";

export class BoundaryNavigation {
  static initialize() {
    return {
      phase: "choose",
      previousBoundaryPort: null,
    };
  }

  static createMessage(observation) {
    const state = observation.memory[KEY];

    if (state?.phase !== "checking" || observation.degree !== 4) {
      return null;
    }

    return { type: "boundary-interior-probe" };
  }

  static compute(observation) {
    const state = structuredClone(
      observation.memory[KEY] ?? this.initialize()
    );

    if (observation.degree === 2) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [KEY]: {
            ...state,
            phase: "corner",
          },
        },
      };
    }

    if (state.phase === "checking") {
      if (observation.degree === 4) {
        const returnPort = observation.memory.incomingPort;
        if (returnPort === undefined) {
          throw new Error("Boundary probe cannot return without an incoming port.");
        }

        return {
          action: { type: "move", port: returnPort },
          memoryUpdates: {
            [KEY]: {
              ...state,
              phase: "returning",
            },
          },
        };
      }

      if (observation.degree === 2) {
        return {
          action: { type: "stay" },
          memoryUpdates: { [KEY]: { ...state, phase: "corner" } },
        };
      }

      if (observation.degree !== 3) {
        throw new Error(`Boundary navigation reached degree ${observation.degree}.`);
      }

      state.previousBoundaryPort = observation.memory.incomingPort;
      state.phase = "choose";
    }

    const incoming = observation.memory.incomingPort;
    const excludedPorts = new Set(
      [incoming, state.previousBoundaryPort].filter(Number.isInteger)
    );

    const candidates = observation.ports
      .filter((port) => !excludedPorts.has(port))
      .sort((a, b) => a - b);

    if (!candidates.length) {
      throw new Error("Could not identify the next boundary port.");
    }

    const port = candidates[0];

    return {
      action: {
        type: "move",
        port,
      },
      memoryUpdates: {
        [KEY]: {
          ...state,
          phase: "checking",
        },
      },
    };
  }
}
