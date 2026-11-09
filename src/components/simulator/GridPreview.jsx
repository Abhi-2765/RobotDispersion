import { useCallback, useEffect, useState } from "react";
import { GridNetworkSvg } from "./GridNetworkSvg.jsx";
import { controlButtonClass } from "./controlStyles.js";

export function GridPreview({
  gridSize,
  nodes,
  selectedNodeId,
  selectedRobotId,
  onSelectNode,
  onSelectRobot,
  isMovingRobot = false,
  summary,
  interactionHint,
  viewportReserve,
  actions,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
}) {
  const [localFullscreen, setLocalFullscreen] = useState(false);
  const isControlled = typeof controlledFullscreen === "boolean";
  const isFullscreen = isControlled ? controlledFullscreen : localFullscreen;
  const usesOverlay = isFullscreen && !isControlled;

  const setFullscreen = useCallback((nextValue) => {
    if (isControlled) onFullscreenChange?.(nextValue);
    else setLocalFullscreen(nextValue);
  }, [isControlled, onFullscreenChange]);

  useEffect(() => {
    if (!isFullscreen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setFullscreen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isFullscreen, setFullscreen]);

  return (
    <section className={`${usesOverlay ? "fixed inset-0 z-50 flex min-w-0 flex-col bg-background" : isFullscreen ? "flex h-dvh min-w-0 flex-col overflow-hidden border-0 bg-surface" : "min-w-0 overflow-hidden border border-border bg-surface"}`} aria-label="Grid preview">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        {summary ?? <span />}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button type="button" className={controlButtonClass} onClick={() => setFullscreen(!isFullscreen)} aria-pressed={isFullscreen}>
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>
      {interactionHint ? <div className="border-b border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">{interactionHint}</div> : null}
      <div className={isFullscreen ? "flex min-h-0 flex-1" : ""}>
        <div className={isFullscreen ? "min-w-0 flex-1" : ""}>
          <GridNetworkSvg
            nodes={nodes}
            gridSize={gridSize}
            selectedNodeId={selectedNodeId}
            selectedRobotId={selectedRobotId}
            onSelectRobot={onSelectRobot}
            isMovingRobot={isMovingRobot}
            onSelectNode={onSelectNode}
            viewportReserve={isFullscreen ? 5 : viewportReserve}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>
      </section>
  );
}
