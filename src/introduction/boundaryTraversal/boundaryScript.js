import { BoundaryNavigation } from "../../simulation/algorithms/nonFaulty/navigation/BoundaryNavigation.js";
import { coordinateFor } from "../../components/simulator/gridPresentation.js";

/**
 * Generates round-by-round frames for the boundary-node-to-corner procedure
 * by executing BoundaryNavigation.compute() on local observations.
 *
 * @param {object} view - Read-only graph snapshot
 * @param {object} robot - The boundary robot being demonstrated { id, nodeId }
 * @param {object} options - Options { scenario: "clean" | "boundary-crash" | "probe-crash" }
 * @returns {object} Script containing frames, stats, and metadata
 */
export function buildBoundaryScript(view, robot, options = {}) {
  const scenario = options.scenario ?? "clean";
  const frames = [];
  const startNodeId = robot.nodeId;

  if (view.degree(startNodeId) !== 3) {
    throw new Error(`Start node ${startNodeId} has degree ${view.degree(startNodeId)}, expected 3 (boundary node).`);
  }

  let currentNodeId = startNodeId;
  let memory = {};
  let round = 1;
  const trail = [startNodeId];
  let boundaryHops = 0;

  // Frame 0: Initial state at boundary node
  frames.push({
    id: frames.length,
    round: 0,
    step: 1,
    activeRobotId: robot.id,
    currentNodeId,
    currentDegree: 3,
    phase: "choose",
    outgoingPort: null,
    incomingPort: null,
    targetNodeId: null,
    excludedPorts: [],
    candidatePorts: view.ports(currentNodeId).sort((a, b) => a - b),
    trail: [...trail],
    activeEdge: null,
    isCrashed: false,
    crashedNodeId: null,
    summary: `Robot ${robot.id} ready at ${coordinateFor(currentNodeId, view.size)}`,
    description: `The robot is situated at a degree-3 boundary node. In an unoriented grid, local ports [${view.ports(currentNodeId).join(", ")}] have arbitrary numbering without any global compass orientation.`,
  });

  const maxRounds = 3 * view.size + 10;

  while (round <= maxRounds) {
    const currentDegree = view.degree(currentNodeId);
    const ports = view.ports(currentNodeId);

    const observation = {
      robotId: robot.id,
      degree: currentDegree,
      ports,
      coLocatedRobotIds: [robot.id],
      memory: structuredClone(memory),
      traversalHistory: [],
    };

    // Evaluate what ports are excluded in BoundaryNavigation
    const incoming = observation.memory.incomingPort;
    const previousBoundaryPort = observation.memory.boundaryNavigation?.previousBoundaryPort;
    const excludedPorts = [incoming, previousBoundaryPort].filter(Number.isInteger);
    const candidates = ports.filter((port) => !excludedPorts.includes(port)).sort((a, b) => a - b);

    // Call the exact paper-defined algorithm implementation
    const decision = BoundaryNavigation.compute(observation);

    if (decision.memoryUpdates) {
      Object.assign(memory, decision.memoryUpdates);
    }

    if (decision.action.type === "stay") {
      // Reached a corner node (degree 2)
      frames.push({
        id: frames.length,
        round,
        step: 6,
        activeRobotId: robot.id,
        currentNodeId,
        currentDegree,
        phase: "corner",
        outgoingPort: null,
        incomingPort: memory.incomingPort ?? null,
        targetNodeId: null,
        excludedPorts,
        candidatePorts: [],
        trail: [...trail],
        activeEdge: null,
        isCrashed: false,
        crashedNodeId: null,
        summary: `Corner reached at ${coordinateFor(currentNodeId, view.size)} (degree 2)`,
        description: `Robot ${robot.id} reached a degree-2 corner node. Per Section 3.1 of the paper, all robots reaching a corner remain settled at the corner for subsequent Stage 2 corner-gathering.`,
      });
      break;
    }

    const port = decision.action.port;
    const targetNodeId = view.neighbour(currentNodeId, port);
    const targetDegree = view.degree(targetNodeId);
    const incomingPort = view.reciprocalPort(currentNodeId, port);

    // Determine edge traversal kind and step
    let step;
    let kind;
    let summary;
    let description;

    if (currentDegree === 4) {
      // Returning from an internal probe
      step = 4;
      kind = "return";
      summary = `Backtracking from internal node ${coordinateFor(currentNodeId, view.size)} to ${coordinateFor(targetNodeId, view.size)}`;
      description = `The internal node has degree 4. As required by Section 3.1, the robot immediately uses reciprocal incoming port ${port} to backtrack to the boundary node.`;
    } else if (targetDegree === 4) {
      // Probing an internal node
      step = 3;
      kind = "probe";
      summary = `Probing port ${port} toward ${coordinateFor(targetNodeId, view.size)} (degree 4)`;
      description = `The robot selected candidate port ${port}. The destination has degree 4 (internal node). The robot will observe this degree on arrival and backtrack on the next round.`;
    } else if (targetDegree === 2) {
      // Heading into a corner
      step = 5;
      kind = "boundary";
      summary = `Moving via port ${port} to corner ${coordinateFor(targetNodeId, view.size)}`;
      description = `Candidate port ${port} leads along the perimeter directly into corner node ${coordinateFor(targetNodeId, view.size)} (degree 2).`;
    } else {
      // Advancing along the boundary
      step = 5;
      kind = "boundary";
      summary = `Advancing via port ${port} to boundary node ${coordinateFor(targetNodeId, view.size)}`;
      description = `Candidate port ${port} leads to boundary node ${coordinateFor(targetNodeId, view.size)} (degree 3). Incoming port ${incomingPort} will be recorded for future exclusions.`;
    }

    // Active movement frame
    frames.push({
      id: frames.length,
      round,
      step,
      activeRobotId: robot.id,
      currentNodeId,
      currentDegree,
      phase: memory.boundaryNavigation?.phase ?? "checking",
      outgoingPort: port,
      incomingPort: memory.incomingPort ?? null,
      targetNodeId,
      excludedPorts,
      candidatePorts: candidates,
      trail: [...trail],
      activeEdge: {
        fromNodeId: currentNodeId,
        toNodeId: targetNodeId,
        fromPort: port,
        toPort: incomingPort,
        kind,
      },
      isCrashed: false,
      crashedNodeId: null,
      summary,
      description,
    });

    // Check for Faulty mode crash triggers
    if (scenario === "probe-crash" && targetDegree === 4) {
      // Robot arrives at internal node and crashes there before returning
      round++;
      frames.push({
        id: frames.length,
        round,
        step: 7,
        activeRobotId: robot.id,
        currentNodeId: targetNodeId,
        currentDegree: 4,
        phase: "crashed",
        outgoingPort: null,
        incomingPort,
        targetNodeId: null,
        excludedPorts: [],
        candidatePorts: [],
        trail: [...trail],
        activeEdge: null,
        isCrashed: true,
        crashedNodeId: targetNodeId,
        summary: `Robot ${robot.id} CRASHED at internal node ${coordinateFor(targetNodeId, view.size)}`,
        description: `During the interior probe, Robot ${robot.id} suffered a crash fault upon entering node ${coordinateFor(targetNodeId, view.size)}. It permanently ceases communication and movement. Per Section 4.1, no retry or recovery is defined; the robot never reaches the corner.`,
      });
      break;
    }

    if (scenario === "boundary-crash" && targetDegree === 3 && boundaryHops >= 1) {
      // Robot arrives at next boundary node and crashes there
      round++;
      trail.push(targetNodeId);
      frames.push({
        id: frames.length,
        round,
        step: 7,
        activeRobotId: robot.id,
        currentNodeId: targetNodeId,
        currentDegree: 3,
        phase: "crashed",
        outgoingPort: null,
        incomingPort,
        targetNodeId: null,
        excludedPorts: [],
        candidatePorts: [],
        trail: [...trail],
        activeEdge: null,
        isCrashed: true,
        crashedNodeId: targetNodeId,
        summary: `Robot ${robot.id} CRASHED at boundary node ${coordinateFor(targetNodeId, view.size)}`,
        description: `While traversing the boundary perimeter, Robot ${robot.id} crashed at ${coordinateFor(targetNodeId, view.size)}. In the crash-fault model (Section 4), the robot loses all memory and stops permanently.`,
      });
      break;
    }

    // Normal move progression
    memory.incomingPort = incomingPort;
    currentNodeId = targetNodeId;
    if (targetDegree === 3 || targetDegree === 2) {
      if (!trail.includes(targetNodeId)) trail.push(targetNodeId);
      if (targetDegree === 3) boundaryHops++;
    }
    round++;
  }

  return {
    robotId: robot.id,
    startNodeId,
    scenario,
    frames,
    totalRounds: frames[frames.length - 1]?.round ?? round,
    reachedCorner: frames[frames.length - 1]?.phase === "corner",
    isCrashed: frames[frames.length - 1]?.isCrashed ?? false,
  };
}

export function boundaryScenarioOptions() {
  return [
    { id: "clean", label: "Clean traversal (no crash)", description: "The robot traverses the boundary and reaches a corner without experiencing a fault." },
    { id: "boundary-crash", label: "Boundary node crash", description: "The robot crashes after traversing along the boundary, permanently stopping at a boundary node." },
    { id: "probe-crash", label: "Interior probe crash", description: "The robot enters an internal node (degree 4) during a probe and crashes before returning." },
  ];
}
