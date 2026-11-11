import { coordinateFor } from "../../components/simulator/gridPresentation.js";
import { planProbe, inferStraightPort } from "./probeSearch.js";
import { narrateProbeMove, narrateDecision, narrateGroupMove } from "./narration.js";
import { blankFrame, markEntered, newProbeRecord, cursorFor, nextPath } from "./frames.js";

/**
 * Educational frame sequence for the non-faulty straight-path discovery
 * (paper Section 3). Pure function of the read-only graph view: no randomness,
 * no engine, no mutation.
 */
export function buildNonFaultyScript(view, groupNodeId, { exploreAll = false } = {}) {
  const at = (nodeId) => coordinateFor(nodeId, view.size);
  const groupIds = view.robotIdsAt(groupNodeId);
  if (groupIds.length < 2 || view.degree(groupNodeId) !== 4) {
    throw new Error("The demo needs two or more robots on an internal node.");
  }

  const referenceId = groupIds[0];
  const explorerId = groupIds[groupIds.length - 1];
  const roles = Object.fromEntries(
    groupIds.map((id) => [id, id === explorerId ? "explorer" : id === referenceId ? "reference" : "group"])
  );

  const frames = [];
  const probes = [];
  const trail = [groupNodeId];
  let round = 0;
  let hop = 0;

  const allAt = (nodeId) => Object.fromEntries(groupIds.map((id) => [id, nodeId]));
  const add = (fields) => {
    const frame = { ...blankFrame(), id: frames.length, round, hop, roles, trail: [...trail], ...fields };
    frames.push(frame);
    return frame;
  };

  add({
    step: 1,
    title: "Initial configuration",
    text: `Robots ${groupIds.map((id) => `#${id}`).join(", ")} share the internal node ${at(groupNodeId)} (degree 4). Robot #${referenceId}, the minimum ID, is the reference robot. Robot #${explorerId}, the maximum ID, is the explorer. Robots elsewhere on the grid are dimmed: this demo follows this one group.`,
    positions: allAt(groupNodeId),
    focusNodeId: groupNodeId,
    explorerNodeId: groupNodeId,
  });

  // Step 2: the whole group leaves through port 1.
  round = 1;
  let yId = view.neighbour(groupNodeId, 1);
  let backwardPort = view.reciprocalPort(groupNodeId, 1);
  trail.push(yId);
  const firstIsBoundary = view.degree(yId) !== 4;
  add({
    step: 2,
    title: firstIsBoundary ? "Boundary reached" : "Group moves through port 1",
    text: `Round 1: every robot in the group moved through port 1 from ${at(groupNodeId)} to ${at(yId)}. Each robot now observes the port it entered through: port ${backwardPort}. That is the backward port, a label local to ${at(yId)}.${firstIsBoundary ? ` ${at(yId)} has degree ${view.degree(yId)}, so the group is already at the boundary.` : ""}`,
    observerNote: "Observer's note: port numbers are only local labels. Port 1 at the old node and the backward port here describe the same edge but are unrelated numbers.",
    positions: allAt(yId),
    focusNodeId: yId,
    explorerNodeId: yId,
    markers: [{ nodeId: yId, port: backwardPort, kind: "backward" }],
    end: firstIsBoundary,
  });
  if (firstIsBoundary) return { frames, probes, groupIds, referenceId, explorerId };

  for (;;) {
    hop += 1;
    const probe = planProbe(view, yId, backwardPort, { exploreAll });
    const normal = exploreAll ? planProbe(view, yId, backwardPort) : probe;
    const complete = exploreAll ? probe : planProbe(view, yId, backwardPort, { exploreAll: true });
    const record = newProbeRecord({ id: probes.length, hop, attempt: 1, yId, backwardPort, probe, exploreAll });
    probes.push(record);

    const found = [];
    let path = [yId];
    for (const move of probe.moves) {
      round += 1;
      path = nextPath(path, move, yId);
      if (move.kind === "return-path" && !found.includes(move.inc)) found.push(move.inc);
      const narration = narrateProbeMove({
        move,
        who: `explorer #${explorerId}`,
        round,
        at,
        yId,
        returnPortsSoFar: found,
      });
      const frame = add({
        ...narration,
        positions: { ...allAt(yId), [explorerId]: move.to },
        focusNodeId: yId,
        explorerNodeId: move.to,
        probeId: record.id,
        treeCursorKey: cursorFor(move),
        probePath: path,
        markers: [
          { nodeId: yId, port: backwardPort, kind: "backward" },
          ...found.map((port) => ({ nodeId: yId, port, kind: "return" })),
        ],
      });
      markEntered(record, move, frame.id);
    }

    const decision = inferStraightPort(view, yId, backwardPort, probe.returnPorts);
    add({
      ...narrateDecision({
        at,
        yId,
        backwardPort,
        returnPorts: probe.returnPorts,
        decision,
        who: `Explorer #${explorerId}`,
      }),
      kind: "annotation",
      positions: allAt(yId),
      focusNodeId: yId,
      explorerNodeId: yId,
      probeId: record.id,
      probePath: [yId],
      markers: [
        { nodeId: yId, port: backwardPort, kind: "backward" },
        ...probe.returnPorts.map((port) => ({ nodeId: yId, port, kind: "return" })),
        { nodeId: yId, port: decision.straightPort, kind: "straight" },
      ],
    });

    // Step 6: the whole group, explorer included, moves through the straight port.
    round += 1;
    const nextId = view.neighbour(yId, decision.straightPort);
    const arrivalPort = view.reciprocalPort(yId, decision.straightPort);
    trail.push(nextId);
    const nextDegree = view.degree(nextId);
    const boundary = nextDegree !== 4;
    const joinedBy = view.robotIdsAt(nextId).filter((id) => !groupIds.includes(id));
    add({
      ...narrateGroupMove({
        round,
        robotIds: groupIds,
        straightPort: decision.straightPort,
        arrivalPort,
        at,
        nextId,
        boundaryDegree: boundary ? nextDegree : null,
        joinedBy,
      }),
      positions: allAt(nextId),
      focusNodeId: nextId,
      explorerNodeId: nextId,
      probeId: record.id,
      markers: [
        { nodeId: yId, port: decision.straightPort, kind: "straight" },
        { nodeId: nextId, port: arrivalPort, kind: "backward" },
      ],
      hopSummary: {
        probeRounds: probe.moves.length,
        total: probe.moves.length + 1,
        normalTotal: normal.moves.length + 1,
        completeTotal: complete.moves.length + 1,
        exploreAll,
      },
      end: boundary,
    });

    if (boundary) break;
    yId = nextId;
    backwardPort = arrivalPort;
  }

  return { frames, probes, groupIds, referenceId, explorerId };
}
