import { useState, useMemo } from "react";
import { usePlayback } from "../hooks/usePlayback.js";
import { PlaybackControls } from "../components/introduction/PlaybackControls.jsx";
import { GridNetworkSvg } from "../components/simulator/GridNetworkSvg.jsx";
import { BoundaryOverlay } from "../components/introduction/BoundaryOverlay.jsx";
import { buildGraphView } from "../introduction/straightPath/graphView.js";
import { buildBoundaryDisplayNodes } from "../introduction/boundaryTraversal/displayNodes.js";
import { BOUNDARY_VARIANTS, tryBuildBoundaryScript } from "../introduction/boundaryTraversal/variants.js";
import { createBoundaryTutorialSimulation } from "../tutorials/setupTutorialGrid.js";

export function BoundaryTraversalTutorialPage({ gridSize, algorithmMode }) {
  const variant = BOUNDARY_VARIANTS[algorithmMode];

  // Deterministic educational simulation setup
  const simulation = useMemo(
    () => createBoundaryTutorialSimulation(gridSize),
    [gridSize]
  );
  const view = useMemo(() => buildGraphView(simulation), [simulation]);
  const boundaryRobot = view.robots.find((r) => view.degree(r.nodeId) === 3);

  const built = useMemo(() => {
    if (!boundaryRobot) return null;
    return tryBuildBoundaryScript(variant, view, boundaryRobot, {
      scenario: "clean",
    });
  }, [variant, view, boundaryRobot]);

  const script = built?.script;
  const playback = usePlayback(script?.frames?.length ?? 1);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  if (!boundaryRobot || !script) {
    return (
      <section className="p-4">
        <p className="rounded-xl border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">
          Could not initialize Boundary Traversal tutorial: {built?.error ?? "No valid boundary robot."}
        </p>
      </section>
    );
  }

  const frame = script.frames[playback.index] ?? script.frames[script.frames.length - 1];
  const staticRobots = view.robots.filter((r) => r.id !== boundaryRobot.id);
  const staticRobotNodeIds = new Set(staticRobots.map((r) => r.nodeId));
  const nodes = buildBoundaryDisplayNodes(view, frame, staticRobots);

  return (
    <section className="space-y-4">
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
              <BoundaryOverlay
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
