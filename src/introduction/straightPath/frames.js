/** Fields every frame carries, so consumers never see undefined. */
export function blankFrame() {
  return {
    kind: "state", // "state" advances a round; "annotation" explains the current round
    observerNote: null,
    notes: [], // [{ type: "paper" | "assumption", id }] (faulty variant)
    crashed: [],
    markers: [], // [{ nodeId, port, kind: "backward" | "return" | "straight" }]
    focusNodeId: null,
    probeId: null,
    treeCursorKey: null,
    probePath: [],
    explorerNodeId: null,
    hopSummary: null,
    attempt: 1,
    end: false,
  };
}

/** Marks a tree node as entered at `frameId` the first time the explorer reaches it. */
export function markEntered(probeRecord, move, frameId) {
  if (!["start", "descend", "return-path"].includes(move.kind)) return;
  const node = probeRecord.tree.find((item) => item.key === move.treeKey);
  if (node && node.enteredAt === null) node.enteredAt = frameId;
}

export function newProbeRecord({ id, hop, attempt, yId, backwardPort, probe, exploreAll }) {
  return {
    id,
    hop,
    attempt,
    yId,
    backwardPort,
    zId: probe.zId,
    firstPort: probe.firstPort,
    exploreAll,
    returnPorts: probe.returnPorts,
    tree: probe.tree.map((node) => ({ ...node, enteredAt: null })),
  };
}

export function cursorFor(move) {
  return move.kind === "home" ? null : move.treeKey;
}

export function nextPath(path, move, yId) {
  switch (move.kind) {
    case "start":
      return [yId, move.to];
    case "descend":
    case "return-path":
      return [...path, move.to];
    case "backtrack":
      return path.slice(0, -1);
    default:
      return [yId];
  }
}
