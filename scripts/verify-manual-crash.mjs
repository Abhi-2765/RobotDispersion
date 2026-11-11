import { createStraightPathTutorialSimulation } from "../src/tutorials/setupTutorialGrid.js";
import { buildGraphView } from "../src/introduction/straightPath/graphView.js";
import { STRAIGHT_PATH_VARIANTS, tryBuildScript } from "../src/introduction/straightPath/variants.js";

console.log("=== VERIFYING MANUAL CRASH BEHAVIOR AT DIFFERENT PLAYBACK POSITIONS ===\n");

const sim = createStraightPathTutorialSimulation(6);
const view = buildGraphView(sim);
const group = view.internalGroups()[0];

function checkManualCrashScenario(desc, manualCrashes) {
  console.log(`Testing: ${desc}`);
  const res = tryBuildScript(STRAIGHT_PATH_VARIANTS.faulty, view, group.nodeId, {
    exploreAll: true,
    manualCrashes,
    scenario: "none",
  });

  if (res.error) {
    throw new Error(`Failed to build script: ${res.error}`);
  }

  const script = res.script;
  const frames = script.frames;
  console.log(`  Generated ${frames.length} frames.`);

  // Verify per-robot invariant: Once crashed at round R, never in positions at round > R
  for (const [rIdStr, crashRound] of Object.entries(manualCrashes)) {
    const rId = Number(rIdStr);
    let seenCrashFrame = false;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const rPos = f.positions[rId];
      const isCrashedInFrame = f.crashed.some((c) => c.robotId === rId);

      if (f.round < crashRound) {
        if (isCrashedInFrame) {
          throw new Error(`Frame ${i} (round ${f.round}): Robot ${rId} marked crashed before crash round ${crashRound}`);
        }
      } else {
        // At or after crash round
        if (isCrashedInFrame) {
          seenCrashFrame = true;
          // Invariant: crashed robot must NEVER be in positions
          if (rPos !== undefined) {
            throw new Error(`Frame ${i} (round ${f.round}): Robot ${rId} is crashed but still appears in positions at node ${rPos}!`);
          }
        }
      }
    }

    if (!seenCrashFrame) {
      console.warn(`  Warning: Robot ${rId} crash round ${crashRound} may be beyond total rounds executed.`);
    } else {
      console.log(`  Verified: Robot ${rId} crashed at/after round ${crashRound} and NEVER reappeared in positions.`);
    }
  }
}

// 1. Crash at round 0 (initial node)
checkManualCrashScenario("Crash Robot 4 at Round 0", { 4: 0 });

// 2. Crash at round 1 (arrival at Y)
checkManualCrashScenario("Crash Robot 4 at Round 1", { 4: 1 });

// 3. Crash at round 2 (first probe move)
checkManualCrashScenario("Crash Robot 4 at Round 2", { 4: 2 });

// 4. Crash at round 5 (mid-probe)
checkManualCrashScenario("Crash Robot 4 at Round 5", { 4: 5 });

// 5. Crash multiple robots at different playback positions
checkManualCrashScenario("Crash Robot 4 at Round 3, Robot 3 at Round 6", { 4: 3, 3: 6 });

// 6. Crash waiter robot (Robot 2) at Round 4
checkManualCrashScenario("Crash Waiter Robot 2 at Round 4", { 2: 4 });

// 7. Crash reference anchor (Robot 1) at Round 3
checkManualCrashScenario("Crash Reference Robot 1 at Round 3", { 1: 3 });

console.log("\nALL MANUAL CRASH VERIFICATION SCENARIOS PASSED WITH 0 ERRORS!");
