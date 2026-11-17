import { createStraightPathTutorialSimulation, createBoundaryTutorialSimulation } from "../src/tutorials/setupTutorialGrid.js";
import { buildGraphView } from "../src/introduction/straightPath/graphView.js";
import { STRAIGHT_PATH_VARIANTS, tryBuildScript } from "../src/introduction/straightPath/variants.js";
import { BOUNDARY_VARIANTS, tryBuildBoundaryScript } from "../src/introduction/boundaryTraversal/variants.js";
import { faultyScenarioOptions } from "../src/introduction/straightPath/faultyScript.js";
import { boundaryScenarioOptions } from "../src/introduction/boundaryTraversal/boundaryScript.js";

console.log("=== TUTORIAL VERIFICATION SUITE ===\n");

const testSizes = [4, 6, 8, 11];

// 1. Verify Straight-Path Tutorial Setup & Scripts
console.log("1. Verifying Straight-Path Tutorial Setup:");
for (const size of testSizes) {
  const sim = createStraightPathTutorialSimulation(size);
  const view = buildGraphView(sim);
  const groups = view.internalGroups();

  if (groups.length !== 1) {
    throw new Error(`Size ${size}: Expected exactly 1 group, got ${groups.length}`);
  }
  const group = groups[0];
  if (view.degree(group.nodeId) !== 4) {
    throw new Error(`Size ${size}: Group node ${group.nodeId} must have degree 4, got ${view.degree(group.nodeId)}`);
  }
  const emptyInternalNodes = view.nodeIds.filter((id) => view.degree(id) === 4 && id !== group.nodeId);
  for (const emptyId of emptyInternalNodes) {
    if (view.robotIdsAt(emptyId).length > 0) {
      throw new Error(`Size ${size}: Node ${emptyId} should be empty`);
    }
  }

  // Non-Faulty
  const nfRes = tryBuildScript(STRAIGHT_PATH_VARIANTS.nonFaulty, view, group.nodeId, { exploreAll: true });
  if (nfRes.error) throw new Error(`Size ${size} NF build error: ${nfRes.error}`);

  // Faulty scenarios
  const options = faultyScenarioOptions(group.count);
  for (const opt of options) {
    const fRes = tryBuildScript(STRAIGHT_PATH_VARIANTS.faulty, view, group.nodeId, { scenario: opt.id, exploreAll: true });
    if (fRes.error) throw new Error(`Size ${size} Faulty (${opt.id}) build error: ${fRes.error}`);
  }
  console.log(`  Size ${size}: Setup valid, NF frames: ${nfRes.script.frames.length}, Faulty scenarios verified.`);
}
console.log("  PASSED: Straight-Path Tutorial setup verified.\n");

// 2. Verify Boundary Traversal Tutorial Setup & Scripts
console.log("2. Verifying Boundary Traversal Tutorial Setup:");
for (const size of testSizes) {
  const sim = createBoundaryTutorialSimulation(size);
  const view = buildGraphView(sim);

  const boundaryRobots = view.robots.filter((r) => view.degree(r.nodeId) === 3);
  if (boundaryRobots.length !== 1) {
    throw new Error(`Size ${size}: Expected exactly 1 boundary robot, got ${boundaryRobots.length}`);
  }
  const robot = boundaryRobots[0];

  const cornerNodeIds = [0, size - 1, (size - 1) * size, size * size - 1];
  for (const cornerId of cornerNodeIds) {
    const count = view.robotIdsAt(cornerId).length;
    if (count < 2) {
      throw new Error(`Size ${size}: Corner node ${cornerId} must have group (>= 2 robots), got ${count}`);
    }
  }

  // Non-Faulty
  const nfRes = tryBuildBoundaryScript(BOUNDARY_VARIANTS.nonFaulty, view, robot, { scenario: "clean" });
  if (nfRes.error) throw new Error(`Size ${size} NF boundary build error: ${nfRes.error}`);
  if (!nfRes.script.reachedCorner) throw new Error(`Size ${size}: Should reach corner`);

  // Faulty scenarios
  const bOptions = boundaryScenarioOptions();
  for (const opt of bOptions) {
    const fRes = tryBuildBoundaryScript(BOUNDARY_VARIANTS.faulty, view, robot, { scenario: opt.id });
    if (fRes.error) throw new Error(`Size ${size} Faulty boundary (${opt.id}) build error: ${fRes.error}`);
  }
  console.log(`  Size ${size}: Setup valid, NF frames: ${nfRes.script.frames.length}, Corner reached: ${nfRes.script.reachedCorner}`);
}
console.log("  PASSED: Boundary Traversal Tutorial setup verified.\n");

console.log("ALL TUTORIAL VERIFICATION TESTS PASSED SUCCESSFULLY!");
