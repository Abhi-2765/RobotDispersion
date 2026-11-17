import { useState, useMemo } from "react";
import { usePlayback } from "../hooks/usePlayback.js";
import { PlaybackControls } from "../components/introduction/PlaybackControls.jsx";
import { GridNetworkSvg } from "../components/simulator/GridNetworkSvg.jsx";
import { StraightPathOverlay } from "../components/introduction/StraightPathOverlay.jsx";
import { buildGraphView } from "../introduction/straightPath/graphView.js";
import { buildDisplayNodes } from "../introduction/straightPath/displayNodes.js";
import { STRAIGHT_PATH_VARIANTS, tryBuildScript } from "../introduction/straightPath/variants.js";
import { createStraightPathTutorialSimulation } from "../tutorials/setupTutorialGrid.js";

export function StraightPathTutorialPage({ gridSize, algorithmMode }) {
  const isFaulty = algorithmMode === "faulty";
  const variant = STRAIGHT_PATH_VARIANTS[algorithmMode];

  // Deterministic educational simulation setup
  const simulation = useMemo(
    () => createStraightPathTutorialSimulation(gridSize),
    [gridSize]
  );
  const view = useMemo(() => buildGraphView(simulation), [simulation]);
  const group = view.internalGroups()[0];

  // Interactive manual crash state for Faulty mode: Map of robotId -> crashRound
  const [manualCrashes, setManualCrashes] = useState(() => ({}));
  const [selectedRobotId, setSelectedRobotId] = useState(4);

  const built = useMemo(() => {
    if (!group) return null;
    return tryBuildScript(variant, view, group.nodeId, {
      exploreAll: true,
      manualCrashes: isFaulty && Object.keys(manualCrashes).length > 0 ? manualCrashes : null,
      scenario: "none",
    });
  }, [variant, view, group, isFaulty, manualCrashes]);

  const script = built?.script;
  const playback = usePlayback(script?.frames?.length ?? 1);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  if (!group || !script) {
    return (
      <section className="p-4">
        <p className="rounded-xl border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">
          Could not initialize Straight-Path Discovery tutorial: {built?.error ?? "No valid internal group."}
        </p>
      </section>
    );
  }

  const frame = script.frames[playback.index] ?? script.frames[script.frames.length - 1];
  const groupRobotIds = script.groupIds;
  const staticRobots = view.robots.filter((robot) => !groupRobotIds.includes(robot.id));
  const staticRobotNodeIds = new Set(staticRobots.map((robot) => robot.nodeId));
  const nodes = buildDisplayNodes(view, frame, staticRobots);

  function handleCrashSelected() {
    if (selectedRobotId === null || !frame) return;
    const currentRound = frame.round ?? 0;
    setManualCrashes((prev) => ({
      ...prev,
      [selectedRobotId]: currentRound,
    }));
  }

  function handleRestoreAll() {
    setManualCrashes({});
    playback.reset();
  }

  return (
    <section className="space-y-4">
      {/* Faulty Mode: Interactive Robot Crash Control */}
      {isFaulty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Robot Group:</span>
            {groupRobotIds.map((rId) => {
              const isCrashed = manualCrashes[rId] !== undefined;
              const isSelected = selectedRobotId === rId;
              const role = frame.roles?.[rId] ?? "robot";
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => setSelectedRobotId(rId)}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "ring-2 ring-primary"
                      : "opacity-90 hover:opacity-100"
                  } ${
                    isCrashed
                      ? "border-danger/60 bg-danger/10 text-danger"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  <span>Robot {rId}</span>
                  {isCrashed ? (
                    <span className="font-bold">Crashed (R{manualCrashes[rId]})</span>
                  ) : (
                    <span className="text-[10px] uppercase text-foreground-muted">({role})</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="border border-danger/60 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-40"
              disabled={selectedRobotId === null || manualCrashes[selectedRobotId] !== undefined}
              onClick={handleCrashSelected}
              title="Simulate permanent crash failure for selected robot at current round"
            >
              Crash Robot {selectedRobotId ? `#${selectedRobotId}` : ""}
            </button>
            {Object.keys(manualCrashes).length > 0 && (
              <button
                type="button"
                className="border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                onClick={handleRestoreAll}
              >
                Restore All
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Standard Playback Controls */}
      <PlaybackControls
        round={frame.round}
        frameNumber={playback.index + 1}
        frameCount={script.frames.length}
        playback={playback}
      />

      {/* Main Large Visual Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="p-2 sm:p-4">
          <GridNetworkSvg
            nodes={nodes}
            gridSize={view.size}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            renderOverlay={() => (
              <StraightPathOverlay
                view={view}
                frame={frame}
                staticRobotNodeIds={staticRobotNodeIds}
              />
            )}
          />
        </div>
      </div>
    </section>
  );
}
