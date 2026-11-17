import { coordinateFor } from "../../components/simulator/gridPresentation.js";
import { planProbe, inferStraightPort, COMPLETE_PROBE_ROUNDS, PAPER_STATED_ROUNDS } from "./probeSearch.js";
import { narrateProbeMove, narrateDecision, narrateGroupMove } from "./narration.js";
import { blankFrame, markEntered, newProbeRecord, cursorFor, nextPath } from "./frames.js";
import { FAULTY_SCENARIO_INFO } from "./faultyNotes.js";

const CRASH_AFTER_ROUND = 6;

export function faultyScenarioOptions(groupSize) {
  return Object.entries(FAULTY_SCENARIO_INFO).map(([id, info]) => ({
    id,
    ...info,
    available: groupSize >= info.minRobots,
  }));
}

export function defaultFaultyScenario(groupSize) {
  const options = faultyScenarioOptions(groupSize);
  return (
    options.find((option) => option.id === "partial" && option.available) ??
    options.find((option) => option.id === "allExplorers" && option.available) ??
    options[0]
  ).id;
}

function planCrash(scenario, hop, attempt, explorers, moveCount, crashedRobotIds = null) {
  if (hop !== 1 || attempt !== 1) return null;
  const after = Math.min(CRASH_AFTER_ROUND, moveCount - 1);
  if (Array.isArray(crashedRobotIds)) {
    const targetExplorers = explorers.filter((id) => crashedRobotIds.includes(id));
    return targetExplorers.length > 0 ? { after, robotIds: targetExplorers } : null;
  }
  if (scenario === "partial" && explorers.length >= 2) {
    return { after, robotIds: explorers.slice(1) }; // the lowest-ID explorer survives
  }
  if (scenario === "allExplorers") return { after, robotIds: [...explorers] };
  return null;
}

const idList = (ids) => ids.map((id) => `#${id}`).join(", ");
const paper = (...ids) => ids.map((id) => ({ type: "paper", id }));
const assume = (...ids) => ids.map((id) => ({ type: "assumption", id }));

/**
 * Educational frame sequence for the fault-tolerant straight-path discovery (Section 4).
 * Supports manual crashes per robot and educational test scenarios.
 */
export function buildFaultyScript(
  view,
  groupNodeId,
  { scenario = "none", exploreAll = false, crashedRobotIds = null, manualCrashes = null } = {}
) {
  const at = (nodeId) => coordinateFor(nodeId, view.size);
  const initialIds = view.robotIdsAt(groupNodeId);
  if (initialIds.length < 2 || view.degree(groupNodeId) !== 4) {
    throw new Error("The demo needs two or more robots on an internal node.");
  }

  // Normalize manualCrashes map: robotId (number) -> round (number)
  const manualCrashMap = new Map();
  if (manualCrashes && typeof manualCrashes === "object") {
    for (const [rId, rRound] of Object.entries(manualCrashes)) {
      manualCrashMap.set(Number(rId), Number(rRound));
    }
  }

  let alive = [...initialIds];
  const crashed = [];
  const frames = [];
  const probes = [];
  const trail = [groupNodeId];
  let round = 0;
  let hop = 0;
  let attempt = 1;
  let explorers = [];
  let waiters = [];
  let referenceId = alive[0];

  const split = () => {
    const explorerCount = Math.floor(alive.length / 2);
    explorers = alive.slice(alive.length - explorerCount);
    waiters = alive.slice(0, alive.length - explorerCount);
    referenceId = alive[0];
  };

  const rolesNow = (liveExplorers = explorers) =>
    Object.fromEntries(
      alive.map((id) => [
        id,
        liveExplorers.includes(id) ? "explorer" : id === referenceId ? "reference" : "waiting",
      ])
    );

  const allAt = (nodeId) => Object.fromEntries(alive.map((id) => [id, nodeId]));

  const add = (fields) => {
    const frame = {
      ...blankFrame(),
      id: frames.length,
      round,
      hop,
      attempt,
      roles: rolesNow(),
      crashed: crashed.map((item) => ({ ...item })),
      trail: [...trail],
      ...fields,
    };
    frames.push(frame);
    return frame;
  };

  const finish = () => ({ frames, probes, groupIds: initialIds });

  // Handle immediate manual crashes before departure (round 0)
  for (const id of [...alive]) {
    if (manualCrashMap.has(id) && manualCrashMap.get(id) <= 0) {
      crashed.push({ robotId: id, nodeId: groupNodeId });
      alive = alive.filter((item) => item !== id);
    }
  }

  split();
  add({
    step: 1,
    title: "Initial configuration",
    text: `Robots ${idList(initialIds)} share the internal node ${at(groupNodeId)} (degree 4). The ${explorers.length} highest IDs (${idList(explorers)}) explore while the remaining ${waiters.length} (${idList(waiters)}) wait. Robot #${referenceId} is badged 'R' as a tutorial visual anchor. Robots elsewhere on the grid are dimmed.`,
    observerNote: "Observer note: The reference badge ('R') is a tutorial visual convention, not a paper protocol requirement.",
    positions: allAt(groupNodeId),
    focusNodeId: groupNodeId,
    explorerNodeId: groupNodeId,
    notes: [...paper("P1"), ...assume("A4")],
  });

  round = 1;
  let yId = view.neighbour(groupNodeId, 1);
  let backwardPort = view.reciprocalPort(groupNodeId, 1);
  trail.push(yId);
  const firstIsBoundary = view.degree(yId) !== 4;

  // Handle manual crashes on round 1 arrival at Y
  for (const id of [...alive]) {
    if (manualCrashMap.has(id) && manualCrashMap.get(id) === 1) {
      crashed.push({ robotId: id, nodeId: yId });
      alive = alive.filter((item) => item !== id);
    }
  }

  add({
    step: 2,
    title: firstIsBoundary ? "Boundary reached" : "Group moves through port 1",
    text: `Round 1: every robot moved through port 1 from ${at(groupNodeId)} to ${at(yId)} and observed its entry port, ${backwardPort}: the backward port, local to ${at(yId)}.${firstIsBoundary ? ` ${at(yId)} has degree ${view.degree(yId)}, so the group is already at the boundary.` : ""}`,
    observerNote: "Observer's note: port numbers are only local labels; they have no fixed compass direction.",
    positions: allAt(yId),
    focusNodeId: yId,
    explorerNodeId: yId,
    markers: [{ nodeId: yId, port: backwardPort, kind: "backward" }],
    notes: paper("P2"),
    end: firstIsBoundary,
  });
  if (firstIsBoundary) return finish();

  for (;;) {
    hop += 1;
    attempt = 1;

    for (;;) {
      if (alive.length < 2) {
        add({
          step: 6,
          kind: "annotation",
          title: "Group too small",
          text: `Only ${alive.length} robot${alive.length === 1 ? "" : "s"} remain${alive.length === 1 ? "s" : ""} at ${at(yId)}. Straight-line movement needs at least two robots, so the demo stops here.`,
          positions: allAt(yId),
          focusNodeId: yId,
          explorerNodeId: yId,
          end: true,
        });
        return finish();
      }

      split();
      const probe = planProbe(view, yId, backwardPort, { exploreAll });
      const record = newProbeRecord({ id: probes.length, hop, attempt, yId, backwardPort, probe, exploreAll });
      probes.push(record);

      add({
        step: 3,
        kind: "annotation",
        title: attempt === 1 ? "Explorers and waiters" : `Attempt ${attempt}: split again`,
        text:
          attempt === 1
            ? `At ${at(yId)} there are ${alive.length} robots. The ${explorers.length} highest IDs (${idList(explorers)}) will explore; ${idList(waiters)} wait here, with #${referenceId} as the reference anchor.`
            : `Attempt ${attempt}: the ${alive.length} robots still at ${at(yId)} split again. The ${explorers.length} highest IDs (${idList(explorers)}) explore; ${idList(waiters)} wait, with #${referenceId} as the reference anchor.`,
        observerNote: "Observer note: The reference badge ('R') is a tutorial visual convention, not a paper protocol requirement.",
        positions: allAt(yId),
        focusNodeId: yId,
        explorerNodeId: yId,
        probeId: record.id,
        markers: [{ nodeId: yId, port: backwardPort, kind: "backward" }],
        notes: attempt === 1 ? [...paper("P1"), ...assume("A1", "A4")] : [...paper("P4"), ...assume("A3")],
      });

      // Automated scenario crash planning (for verify scripts) if no manual crashes exist
      const scriptCrash = manualCrashMap.size === 0
        ? planCrash(scenario, hop, attempt, explorers, probe.moves.length, crashedRobotIds)
        : null;

      const startRound = round;
      const found = [];
      let liveExplorers = [...explorers];
      let path = [yId];
      let aborted = false;

      for (const [index, move] of probe.moves.entries()) {
        round += 1;
        path = nextPath(path, move, yId);
        if (move.kind === "return-path" && !found.includes(move.inc)) found.push(move.inc);
        const who =
          liveExplorers.length === 1 ? `explorer #${liveExplorers[0]}` : `explorers ${idList(liveExplorers)}`;
        const positions = Object.fromEntries(
          alive.map((id) => [id, liveExplorers.includes(id) ? move.to : yId])
        );

        const frame = add({
          ...narrateProbeMove({ move, who, round, at, yId, returnPortsSoFar: found }),
          roles: rolesNow(liveExplorers),
          positions,
          focusNodeId: yId,
          explorerNodeId: move.to,
          probeId: record.id,
          treeCursorKey: cursorFor(move),
          probePath: path,
          markers: [
            { nodeId: yId, port: backwardPort, kind: "backward" },
            ...found.map((port) => ({ nodeId: yId, port, kind: "return" })),
          ],
          notes: index === 0 ? paper("P2") : [],
        });
        markEntered(record, move, frame.id);

        // Check manual crashes for explorers or waiters at this round
        let manualCrashingExplorers = [];
        if (manualCrashMap.size > 0) {
          manualCrashingExplorers = liveExplorers.filter((id) => manualCrashMap.get(id) <= round);
          const crashingWaiters = waiters.filter((id) => manualCrashMap.get(id) <= round && alive.includes(id));
          if (crashingWaiters.length > 0) {
            for (const wid of crashingWaiters) {
              crashed.push({ robotId: wid, nodeId: yId });
              alive = alive.filter((id) => id !== wid);
              waiters = waiters.filter((id) => id !== wid);
            }
            if (!waiters.includes(referenceId)) {
              referenceId = waiters[0] ?? alive[0];
            }
            add({
              step: 3,
              kind: "annotation",
              title: "Waiting robot crashes",
              text: `Round ${round}: waiting robot${crashingWaiters.length > 1 ? "s" : ""} ${idList(crashingWaiters)} crashed at ${at(yId)}. It ceases all communication and movement.${waiters.length > 0 ? ` Waiting robot #${referenceId} is badged 'R' as a tutorial visual anchor.` : " No waiting robots remain at the reference node."}`,
              roles: rolesNow(liveExplorers),
              positions: Object.fromEntries(
                alive.map((id) => [id, liveExplorers.includes(id) ? move.to : yId])
              ),
              focusNodeId: yId,
              explorerNodeId: move.to,
              probeId: record.id,
              treeCursorKey: cursorFor(move),
              probePath: path,
              markers: [
                { nodeId: yId, port: backwardPort, kind: "backward" },
                ...found.map((port) => ({ nodeId: yId, port, kind: "return" })),
              ],
              notes: [...paper("P4"), ...assume("A4", "A5")],
            });
          }
        }

        const crashing = manualCrashMap.size > 0
          ? manualCrashingExplorers
          : (scriptCrash && index + 1 === scriptCrash.after
              ? scriptCrash.robotIds.filter((id) => liveExplorers.includes(id))
              : []);

        if (crashing.length > 0) {
          for (const id of crashing) crashed.push({ robotId: id, nodeId: move.to });
          liveExplorers = liveExplorers.filter((id) => !crashing.includes(id));
          alive = alive.filter((id) => !crashing.includes(id));

          add({
            step: 3,
            kind: "annotation",
            title: "Explorer crashes",
            text: `Round ${round}: robot${crashing.length > 1 ? "s" : ""} ${idList(crashing)} crashed at ${at(move.to)}. A crashed robot ceases all movement and communication.${liveExplorers.length ? ` Explorer${liveExplorers.length > 1 ? "s" : ""} ${idList(liveExplorers)} keep${liveExplorers.length > 1 ? "" : "s"} exploring: one survivor is enough to report.` : " No explorer is left to report."}`,
            roles: rolesNow(liveExplorers),
            positions: Object.fromEntries(
              alive.map((id) => [id, liveExplorers.includes(id) ? move.to : yId])
            ),
            focusNodeId: yId,
            explorerNodeId: move.to,
            probeId: record.id,
            treeCursorKey: cursorFor(move),
            probePath: path,
            markers: [
              { nodeId: yId, port: backwardPort, kind: "backward" },
              ...found.map((port) => ({ nodeId: yId, port, kind: "return" })),
            ],
            notes: [...paper("P3"), ...assume("A5", "A6")],
          });

          if (liveExplorers.length === 0) {
            aborted = true;
            break;
          }
        }
      }

      if (aborted) {
        round = Math.max(round, startRound + COMPLETE_PROBE_ROUNDS);
        add({
          step: 3,
          kind: "annotation",
          title: "Waiting robots time out",
          text: `Rounds ${startRound + 1}–${round}: no explorer reported back. The waiting robots ${idList(waiters)} waited at ${at(yId)} up to the timeout (${COMPLETE_PROBE_ROUNDS} rounds in this physical DFS traversal demonstration). The paper specifies a theoretical upper bound of ${PAPER_STATED_ROUNDS} rounds per hop. The ${alive.length} surviving robots will split again and repeat.`,
          observerNote: "Observer note: The paper charges a theoretical bound of 56 rounds per hop (2 × 27 + 2). In this visual demonstration, a physical complete DFS walk over all 39 edges down and back takes 80 rounds (2 × 39 + 2).",
          roles: rolesNow([]),
          positions: allAt(yId),
          focusNodeId: yId,
          explorerNodeId: yId,
          probeId: record.id,
          markers: [{ nodeId: yId, port: backwardPort, kind: "backward" }],
          notes: [...paper("P4"), ...assume("A2", "A6")],
        });
        attempt += 1;
        continue;
      }

      const decision = inferStraightPort(view, yId, backwardPort, probe.returnPorts);
      record.straightPort = decision.straightPort;
      const straightPort = decision.straightPort;

      add({
        ...narrateDecision({
          at,
          yId,
          backwardPort,
          returnPorts: probe.returnPorts,
          decision,
          who: liveExplorers.length === 1 ? `Explorer #${liveExplorers[0]}` : `Explorers ${idList(liveExplorers)}`,
        }),
        positions: allAt(yId),
        focusNodeId: yId,
        explorerNodeId: yId,
        probeId: record.id,
        markers: [
          { nodeId: yId, port: backwardPort, kind: "backward" },
          ...probe.returnPorts.map((port) => ({ nodeId: yId, port, kind: "return" })),
          { nodeId: yId, port: straightPort, kind: "straight" },
        ],
        notes: paper("P3"),
      });

      round += 1;
      const nextY = view.neighbour(yId, straightPort);
      const arrivalPort = view.reciprocalPort(yId, straightPort);
      trail.push(nextY);
      const nextDegree = view.degree(nextY);
      const isBoundary = nextDegree !== 4;
      const joinedBy = view.robotIdsAt(nextY).filter((id) => !initialIds.includes(id));

      add({
        ...narrateGroupMove({
          round,
          robotIds: alive,
          straightPort,
          arrivalPort,
          at,
          nextId: nextY,
          boundaryDegree: isBoundary ? nextDegree : null,
          joinedBy,
        }),
        positions: allAt(nextY),
        focusNodeId: nextY,
        explorerNodeId: nextY,
        markers: [
          { nodeId: yId, port: straightPort, kind: "straight" },
          { nodeId: nextY, port: arrivalPort, kind: "backward" },
        ],
        notes: paper("P5"),
        end: isBoundary,
      });

      if (isBoundary) return finish();
      yId = nextY;
      backwardPort = arrivalPort;
      break;
    }
  }
}
