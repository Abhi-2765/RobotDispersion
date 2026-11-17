/**
 * Dev-only cross-check (not imported by the app).
 *
 * Runs the repository's real StraightLineNavigation through SimulationEngine on
 * freshly built, seeded grids and compares every hop against the introduction
 * page's own model (planProbe + inferStraightPort): same node path, same
 * rounds per hop. It never modifies engine or simulator code.
 *
 *   node scripts/verify-straight-path.mjs
 */
import { createSimulation } from "../src/simulation/SimulationSetup.js";
import { SimulationEngine } from "../src/simulation/engine/SimulationEngine.js";
import { NonFaultyAlgorithm } from "../src/simulation/algorithms/nonFaulty/NonFaultyAlgorithm.js";
import { buildGraphView } from "../src/introduction/straightPath/graphView.js";
import {
  planProbe,
  inferStraightPort,
  COMPLETE_PROBE_ROUNDS,
  PAPER_STATED_ROUNDS,
} from "../src/introduction/straightPath/probeSearch.js";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Model: hops of {rounds, to} until the group first reaches a non-internal node. */
function modelLine(view, startId) {
  const hops = [];
  const path = [startId];
  const y0 = view.neighbour(startId, 1);
  hops.push({ rounds: 1, to: y0 });
  path.push(y0);
  let yId = y0;
  let backward = view.reciprocalPort(startId, 1);
  while (view.degree(yId) === 4) {
    const probe = planProbe(view, yId, backward);
    const { straightPort } = inferStraightPort(view, yId, backward, probe.returnPorts);
    const complete = planProbe(view, yId, backward, { exploreAll: true });
    const next = view.neighbour(yId, straightPort);
    hops.push({
      rounds: probe.moves.length + 1,
      completeRounds: complete.moves.length + 1,
      to: next,
    });
    backward = view.reciprocalPort(yId, straightPort);
    yId = next;
    path.push(next);
  }
  return hops;
}

const SIZES = [6, 8, 12];
const SEEDS = 150;
let lines = 0;
let hopsChecked = 0;
let mismatches = 0;
let engineErrors = 0;
let maxHop = 0;
let maxCompleteHop = 0;
let completeAt80 = 0;
let worstLineRatio = 0;

for (const size of SIZES) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    // A deterministic internal start node, spread over the interior.
    const row = 1 + ((seed * 5) % (size - 2));
    const col = 1 + ((seed * 7) % (size - 2));
    const startId = row * size + col;
    const groupSize = 2 + (seed % 4);
    const placements = Array(groupSize).fill(startId);

    const sim = createSimulation({
      gridSize: size,
      robotCount: groupSize,
      placementMode: "custom",
      customPlacements: placements,
      random: seededRandom(seed * 31 + size),
    });
    const view = buildGraphView(sim); // snapshot BEFORE the engine mutates anything
    const expected = modelLine(view, startId);

    const algorithm = new NonFaultyAlgorithm({ n: size * size });
    const engine = new SimulationEngine(sim, algorithm);
    const observed = [];
    let lastNode = startId;
    let lastRound = 0;
    try {
      while (observed.length < expected.length) {
        engine.step();
        const nodes = new Set(sim.robots.map((r) => r.currentNode.id));
        if (nodes.size === 1) {
          const [nodeId] = nodes;
          if (nodeId !== lastNode) {
            observed.push({ rounds: sim.round - lastRound, to: nodeId });
            lastNode = nodeId;
            lastRound = sim.round;
          }
        }
        if (sim.round > 20000) throw new Error("runaway");
      }
    } catch (error) {
      engineErrors++;
      console.log(`engine error size=${size} seed=${seed}: ${error.message}`);
      continue;
    }

    lines++;
    expected.forEach((hop, index) => {
      hopsChecked++;
      const got = observed[index];
      if (!got || got.to !== hop.to || got.rounds !== hop.rounds) {
        mismatches++;
        if (mismatches <= 5) {
          console.log(`MISMATCH size=${size} seed=${seed} hop=${index}`, { hop, got });
        }
      }
      if (index > 0) {
        maxHop = Math.max(maxHop, hop.rounds);
        maxCompleteHop = Math.max(maxCompleteHop, hop.completeRounds);
        if (hop.completeRounds === COMPLETE_PROBE_ROUNDS + 1) completeAt80++;
      }
    });
    const total = expected.reduce((sum, hop) => sum + hop.rounds, 0);
    worstLineRatio = Math.max(worstLineRatio, total / (56 * size));
  }
}

console.log({
  lines,
  hopsChecked,
  mismatches,
  engineErrors,
  maxProbeHopRoundsIncludingGroupMove: maxHop,
  maxCompleteHopRoundsIncludingGroupMove: maxCompleteHop,
  hopsWithFullTree80Plus1: completeAt80,
  paperStatedPerHop: PAPER_STATED_ROUNDS,
  worstLineTotalOver56TimesSize: Number(worstLineRatio.toFixed(3)),
});
process.exit(mismatches || engineErrors ? 1 : 0);
