import { coordinateFor } from "./gridPresentation.js";
import { controlButtonClass, controlSelectClass, primaryControlButtonClass } from "./controlStyles.js";

export function RobotInspector({
  robots,
  selectedRobotId,
  onSelectRobot,
  gridSize,
  onMoveRobot,
  movingRobotId = null,
  onCancelMove,
  onCrashRobot,
  mode = "simulator",
}) {
  const robot = robots.find((item) => item.id === selectedRobotId) ?? null;

  return (
    <aside className="border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="mr-auto text-base font-bold">Robot details</h3>
        <label className="sr-only" htmlFor="robot-inspector-select">Select robot</label>
        <select
          id="robot-inspector-select"
          className={controlSelectClass}
          value={selectedRobotId ?? ""}
          onChange={(event) => onSelectRobot(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">Select robot</option>
          {robots.map((item) => <option key={item.id} value={item.id}>Robot {item.id}</option>)}
        </select>
      </div>

      {!robot ? <p className="mt-3 text-sm text-foreground-muted">Select a robot to inspect its model state.</p> : <div className="mt-4 space-y-3 text-xs">
        <div className="flex justify-between gap-3"><span className="text-foreground-muted">Position</span><strong className="font-medium">{robot.currentNode ? coordinateFor(robot.currentNode.id, gridSize) : "Crashed"}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-foreground-muted">Status</span><strong className="font-medium">{robot.alive ? "Alive" : "Crashed"}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-foreground-muted">Role</span><strong className="font-medium">{robot.role ?? "Unassigned"}</strong></div>

        {onCrashRobot && robot.alive ? (
          <button
            type="button"
            className="w-full border border-danger/60 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
            onClick={() => onCrashRobot(robot.id)}
            title="Simulate permanent crash failure for this robot"
          >
            💥 Crash robot (Simulate fault)
          </button>
        ) : null}

        {onMoveRobot ? (movingRobotId === robot.id ? (
          <div className="flex items-center justify-between gap-2 border-l-2 border-primary bg-primary/5 p-2 text-primary">
            <span>Choose a destination node.</span>
            <button type="button" className={controlButtonClass} onClick={onCancelMove}>Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            className={`${primaryControlButtonClass} w-full`}
            disabled={!robot.alive}
            onClick={() => onMoveRobot(robot.id)}
          >
            Move robot
          </button>
        )) : null}

        {mode === "simulator" ? <>
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer font-medium">Private memory</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words border border-border bg-background p-2 text-[11px] leading-relaxed">{JSON.stringify(robot.memory, null, 2)}</pre>
          </details>

          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer font-medium">Traversal history ({robot.traversalHistory.length})</summary>
            {robot.traversalHistory.length ? <ol className="mt-2 max-h-48 space-y-1 overflow-auto text-foreground-muted">
              {robot.traversalHistory.map((move, index) => <li key={`${move.round}-${index}`} className="tabular-nums">Round {move.round}: port {move.outgoingPort} → {move.incomingPort}</li>)}
            </ol> : <p className="mt-2 text-foreground-muted">No moves yet.</p>}
          </details>
        </> : null}
      </div>}
    </aside>
  );
}
