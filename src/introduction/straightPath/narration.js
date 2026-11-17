import { PROBE_DEPTH } from "./probeSearch.js";

/** Short, plain-language text for one explorer move. `at` maps node ids to display names. */
export function narrateProbeMove({ move, who, round, at, yId, returnPortsSoFar }) {
  switch (move.kind) {
    case "start":
      return {
        step: 3,
        title: "Probe starts",
        text: `Round ${round}: ${who} moved through port ${move.out}, the lowest port at ${at(yId)} other than the backward port, to Z = ${at(move.to)}, arriving via port ${move.inc}. From Z it explores ${PROBE_DEPTH} more levels, taking every port except the one it just entered by. That is 3 choices per level, so up to 3 × 3 × 3 = 27 paths.`,
      };
    case "descend":
      return {
        step: 3,
        title: "Probe goes deeper",
        text: `Round ${round}: ${who} moved through port ${move.out} to ${at(move.to)} (level ${move.depth} of ${PROBE_DEPTH}), arriving via port ${move.inc}. Port path from Z: ${move.portPath.join(" → ")}.`,
      };
    case "return-path":
      return {
        step: 4,
        title: returnPortsSoFar.length === 2 ? "Second return port found" : "First return port found",
        text: `Round ${round}: ${who} moved through port ${move.out} and arrived back at the reference node ${at(yId)} through its port ${move.inc} (port path from Z: ${move.portPath.join(" → ")}). Return ports found so far: ${returnPortsSoFar.join(", ")}.`,
      };
    case "backtrack":
      return {
        step: 3,
        title: "Probe backtracks",
        text: move.afterReturn
          ? `Round ${round}: ${who} backtracked through port ${move.out} to ${at(move.to)} to keep exploring the remaining paths.`
          : move.depth === PROBE_DEPTH
            ? `Round ${round}: ${who} reached level ${PROBE_DEPTH}, which is not the reference, and backtracked through port ${move.out} to ${at(move.to)}.`
            : `Round ${round}: everything below was explored, so ${who} backtracked through port ${move.out} to ${at(move.to)}.`,
      };
    case "home":
      return {
        step: 4,
        title: "Complete exploration ends",
        text: `Round ${round}: every path was explored. ${who} walked from Z back to the reference node ${at(yId)} through port ${move.out}.`,
      };
    default:
      throw new Error(`Unknown probe move: ${move.kind}`);
  }
}

/** Step 5: the paper's case (i) / case (ii) reasoning. */
export function narrateDecision({ at, yId, backwardPort, returnPorts, decision, who }) {
  const [first, second] = [...returnPorts].sort((a, b) => a - b);
  const lead = `${who} is back at the reference node ${at(yId)} and has found two return ports, ${first} and ${second}. They are 180° apart: the two paths that return to the reference run around the two sides of the edge Y–Z.`;

  if (decision.case === 1) {
    return {
      step: 5,
      title: "Straight direction: case 1",
      text: `${lead} Case 1: the backward port (${backwardPort}) is one of the return ports, so the other return port, ${decision.straightPort}, is opposite to it. That is the straight direction.`,
      observerNote:
        "Observer's note: the explorer's first probe turned away from the line, so one return path happened to arrive through the backward port.",
    };
  }

  return {
    step: 5,
    title: "Straight direction: case 2",
    text: `${lead} Case 2: neither return port is the backward port (${backwardPort}). Besides the two return ports, only the backward port and one other port remain, so port ${decision.straightPort} must be opposite to the backward port. That is the straight direction.`,
    observerNote:
      "Observer's note: the explorer's first probe continued the line, so both return paths arrived from the sides.",
  };
}

export function narrateGroupMove({ round, robotIds, straightPort, arrivalPort, at, nextId, boundaryDegree, joinedBy }) {
  const ids = robotIds.map((id) => `#${id}`).join(", ");
  const base = `Round ${round}: all robots (${ids}) moved through port ${straightPort} to ${at(nextId)}, arriving via port ${arrivalPort}, which is the new backward port.`;
  const tail =
    boundaryDegree === null
      ? " The node has degree 4, so straight-path discovery repeats here."
      : ` ${at(nextId)} has degree ${boundaryDegree}: the group has reached the boundary, so straight-path discovery is finished.`;
  return {
    step: 6,
    title: boundaryDegree === null ? "Group moves straight" : "Boundary reached",
    text: base + tail,
    observerNote: joinedBy?.length
      ? `Observer's note: robot${joinedBy.length > 1 ? "s" : ""} ${joinedBy.map((id) => `#${id}`).join(", ")} already sit${joinedBy.length > 1 ? "" : "s"} at ${at(nextId)}. This demo follows one group; in the full algorithm a settled singleton joins the arriving group.`
      : null,
  };
}
