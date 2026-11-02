import { CornerNavigation } from "../helpers/CornerNavigation.js";

const KEY = "boundaryNavigation";

export class BoundaryNavigation {
  static initialize() {
    return {
      phase: "choose",
      triedPorts: [],
      previousPort: null,
      steps: 0,
    };
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
        return {
          action: {
            type: "move",
            port: observation.memory.incomingPort,
          },
          memoryUpdates: {
            [KEY]: {
              ...state,
              phase: "choose",
            },
          },
        };
      }

      return {
        action: { type: "stay" },
        memoryUpdates: {
          [KEY]: {
            ...state,
            phase: "choose",
            triedPorts: [],
            steps: state.steps + 1,
          },
        },
      };
    }

    const incoming = observation.memory.incomingPort;

    const candidates = observation.ports
      .filter(port => port !== incoming)
      .filter(port => !state.triedPorts.includes(port))
      .sort((a, b) => a - b);

    if (!candidates.length) {
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
          triedPorts: [...state.triedPorts, port],
          previousPort: port,
        },
      },
    };
  }

  static isAtCorner(observation) {
    return observation.degree === 2;
  }
}
