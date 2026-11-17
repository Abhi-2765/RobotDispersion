/**
 * Shared primitives for the straight-path probe (paper Sections 3 and 4).
 *
 * The group has moved X -> Y, so Y's `backwardPort` leads to X. The explorer
 * leaves Y through the lowest port other than the backward port, reaching Z,
 * then walks the port tree three further levels below Z (3 choices per level,
 * ascending local-port order). Two of those walks come back to Y; the ports at
 * Y through which they arrive are the two "return ports", 180 degrees apart.
 */
export const PROBE_DEPTH = 3;
const BRANCHING = 3;

/** Number of edges in the probe tree below Z in a full-degree region (3 + 9 + 27 = 39). */
export const FULL_TREE_EDGES = Array.from(
  { length: PROBE_DEPTH },
  (_, level) => BRANCHING ** (level + 1)
).reduce((sum, count) => sum + count, 0);

/**
 * Rounds of a complete DFS walk traversal: Y->Z, every tree edge twice, Z->Y.
 * Traversing all 39 tree edges down and back takes 2 * 39 = 78 rounds, plus 2 for Y <-> Z.
 */
export const COMPLETE_PROBE_ROUNDS = 2 + 2 * FULL_TREE_EDGES; // 80

/**
 * The paper's stated bound in Section 3 & 4: 2 rounds per level-3 node (2 * 27 = 54)
 * plus 2 rounds for moving one hop away (Y <-> Z), totaling 56 rounds.
 */
export const PAPER_STATED_ROUNDS = 2 * BRANCHING ** PROBE_DEPTH + 2; // 56

function treeLabel(ports) {
  return ports.length === 0 ? "Z" : ports.join("→");
}

/**
 * Plans the explorer's depth-first walk. Pure function of the port data.
 *
 * Move kinds: "start" (Y->Z), "descend", "return-path" (arrival at Y at depth 3),
 * "backtrack", "home" (Z->Y after complete exploration).
 */
export function planProbe(view, yId, backwardPort, { exploreAll = false } = {}) {
  const firstPort = view
    .ports(yId)
    .filter((port) => port !== backwardPort)
    .sort((a, b) => a - b)[0];
  if (firstPort === undefined) {
    throw new Error("No probe port remains after excluding the backward port.");
  }

  const zId = view.neighbour(yId, firstPort);
  const moves = [];
  const tree = [];
  const returnPorts = [];
  let stopped = false;

  moves.push({
    kind: "start",
    from: yId,
    to: zId,
    out: firstPort,
    inc: view.reciprocalPort(yId, firstPort),
    treeKey: "Z",
  });

  const root = {
    key: "Z",
    nodeId: zId,
    depth: 0,
    parentKey: null,
    viaPort: firstPort,
    portPath: [],
    label: "Z",
    isReturn: false,
  };
  tree.push(root);

  function visit(treeNode, incomingPort) {
    const childPorts = view
      .ports(treeNode.nodeId)
      .filter((port) => port !== incomingPort)
      .sort((a, b) => a - b);

    for (const port of childPorts) {
      if (stopped) return;
      const childId = view.neighbour(treeNode.nodeId, port);
      const childInc = view.reciprocalPort(treeNode.nodeId, port);
      const portPath = [...treeNode.portPath, port];
      const child = {
        key: portPath.join("."),
        nodeId: childId,
        depth: treeNode.depth + 1,
        parentKey: treeNode.key,
        viaPort: port,
        portPath,
        label: treeLabel(portPath),
        isReturn: childId === yId,
      };
      tree.push(child);

      moves.push({
        kind: child.isReturn ? "return-path" : "descend",
        from: treeNode.nodeId,
        to: childId,
        out: port,
        inc: childInc,
        depth: child.depth,
        treeKey: child.key,
        portPath,
      });

      if (child.isReturn) {
        if (!returnPorts.includes(childInc)) returnPorts.push(childInc);
        if (!exploreAll && returnPorts.length === 2) {
          stopped = true;
          return;
        }
      } else if (child.depth < PROBE_DEPTH) {
        visit(child, childInc);
        if (stopped) return;
      }

      moves.push({
        kind: "backtrack",
        from: childId,
        to: treeNode.nodeId,
        out: childInc,
        inc: port,
        depth: child.depth,
        treeKey: treeNode.key,
        afterReturn: child.isReturn,
      });
    }
  }

  visit(root, view.reciprocalPort(yId, firstPort));

  if (!stopped) {
    // Complete exploration finished: the explorer walks Z -> Y.
    moves.push({
      kind: "home",
      from: zId,
      to: yId,
      out: view.reciprocalPort(yId, firstPort),
      inc: firstPort,
      treeKey: "Z",
    });
  }

  if (returnPorts.length !== 2) {
    throw new Error("The probe did not find exactly two return ports.");
  }

  return { firstPort, zId, moves, tree, returnPorts, stoppedEarly: stopped };
}

/**
 * Paper Section 3, cases (i) and (ii): the straight port from the two return
 * ports and the backward port.
 */
export function inferStraightPort(view, yId, backwardPort, returnPorts) {
  if (returnPorts.includes(backwardPort)) {
    return {
      case: 1,
      straightPort: returnPorts.find((port) => port !== backwardPort),
      remainingPorts: [],
    };
  }

  const remainingPorts = view
    .ports(yId)
    .filter((port) => port !== backwardPort && !returnPorts.includes(port));
  if (remainingPorts.length !== 1) {
    throw new Error("Could not uniquely infer the straight port.");
  }
  return { case: 2, straightPort: remainingPorts[0], remainingPorts };
}
