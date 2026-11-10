/**
 * Fault-tolerant boundary-only movement using local port labels.
 *
 * Traverses boundary nodes (degree 3) and corners (degree 2).
 * On reaching degree 4 (internal probe), immediately returns and chooses
 * the other candidate port.
 *
 * Robust against robot crashes: any surviving seeker/walker can advance
 * independently using local incomingPort observation.
 */
export class FaultyBoundaryTraversal {
  static start(observation, firstPort, options = {}) {
    if (observation.degree !== 2 && observation.degree !== 3) {
      throw new Error("Faulty boundary traversal must start at a corner or boundary node.");
    }

    if (!observation.ports.includes(firstPort)) {
      throw new Error(`Invalid first boundary port ${firstPort}.`);
    }

    const state = {
      phase: "moving",
      pendingMove: true,
      pendingKind: "boundary",
      firstPort,
      lastBoundaryPort: null,
      remainingEdges: options.remainingEdges ?? null,
      completedEdges: 0,
    };

    return {
      action: { type: "move", port: firstPort },
      state,
      edgeCompleted: false,
    };
  }

  static advance(observation, previousState) {
    const state = structuredClone(previousState);
    let edgeCompleted = false;

    if (state.pendingMove) {
      // If we probed into an interior node (degree 4), return back immediately
      if (state.pendingKind === "probe" && observation.degree === 4) {
        const returnPort = observation.memory.incomingPort;
        if (returnPort === undefined) {
          throw new Error("Boundary probe reached interior without return port.");
        }

        state.pendingMove = true;
        state.pendingKind = "return";
        state.phase = "probe-returning";
        return {
          action: { type: "move", port: returnPort },
          state,
          edgeCompleted: false,
        };
      }

      // If we returned from an interior probe back to the degree 3 boundary node
      if (state.pendingKind === "return") {
        if (observation.degree !== 3) {
          throw new Error("Boundary probe did not return to its degree-3 node.");
        }

        const incomingPort = observation.memory.incomingPort;
        const candidates = observation.ports.filter(
          (port) => port !== incomingPort && port !== state.lastBoundaryPort
        );

        if (candidates.length !== 1) {
          throw new Error("Could not identify alternative boundary port after probe.");
        }

        state.pendingMove = true;
        state.pendingKind = "boundary";
        state.phase = "moving";
        return {
          action: { type: "move", port: candidates[0] },
          state,
          edgeCompleted: false,
        };
      }

      if (observation.degree !== 2 && observation.degree !== 3) {
        throw new Error(`Expected a boundary node, received degree ${observation.degree}.`);
      }

      state.pendingMove = false;
      state.phase = "at-boundary";
      state.lastBoundaryPort = observation.memory.incomingPort;
      state.completedEdges += 1;
      if (state.remainingEdges !== null) state.remainingEdges -= 1;
      edgeCompleted = true;

      if (state.remainingEdges === 0) {
        state.phase = "arrived";
        return {
          action: { type: "stay" },
          state,
          edgeCompleted,
        };
      }
    }

    // At a corner (degree 2), take the continuation port
    if (observation.degree === 2) {
      const incomingPort = observation.memory.incomingPort;
      const nextPort = observation.ports.find((port) => port !== incomingPort) ?? observation.ports[0];
      if (nextPort === undefined) {
        throw new Error("Corner has no boundary continuation.");
      }

      state.pendingMove = true;
      state.pendingKind = "boundary";
      state.phase = "moving";
      return {
        action: { type: "move", port: nextPort },
        state,
        edgeCompleted,
      };
    }

    // At a boundary node (degree 3), probe the lowest candidate
    if (observation.degree === 3) {
      const incomingPort = observation.memory.incomingPort;

      if (state.lastBoundaryPort === null || state.lastBoundaryPort === undefined) {
        state.lastBoundaryPort = incomingPort;
      }

      const candidates = observation.ports
        .filter((port) => port !== state.lastBoundaryPort)
        .sort((a, b) => a - b);

      if (candidates.length !== 2) {
        throw new Error("Boundary node must have two ports other than the previous boundary port.");
      }

      state.pendingMove = true;
      state.pendingKind = "probe";
      state.phase = "probing";
      return {
        action: { type: "move", port: candidates[0] },
        state,
        edgeCompleted,
      };
    }

    throw new Error(`Boundary traversal cannot continue from degree ${observation.degree}.`);
  }
}
