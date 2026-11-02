import { useCallback, useEffect, useMemo, useState } from "react";
import { GridPreview } from "../components/simulator/GridPreview.jsx";
import { NodeInspector } from "../components/simulator/NodeInspector.jsx";
import { RobotInspector } from "../components/simulator/RobotInspector.jsx";
import { SimulationControls } from "../components/simulator/SimulationControls.jsx";
import { coordinateFor } from "../components/simulator/gridPresentation.js";
import { SimulationEngine } from "../simulation/engine/SimulationEngine.js";
import { NonFaultyAlgorithm } from "../simulation/algorithms/nonFaulty/NonFaultyAlgorithm.js";

const SPEED_OPTIONS = [120, 400, 1000];
const MAX_ACTIVITY_ITEMS = 120;

function describeStep(result, previousStage, nextStage) {
  const events = [];
  const messageCount = Object.values(result.inboxes).reduce(
    (count, inbox) => count + inbox.length,
    0
  );

  if (previousStage !== nextStage) {
    events.push({
      id: `${result.round}-stage`,
      round: result.round,
      text: `Entered Stage ${nextStage}`,
      kind: "stage",
    });
  }

  if (messageCount > 0) {
    events.push({
      id: `${result.round}-messages`,
      round: result.round,
      text: `${messageCount} message${messageCount === 1 ? "" : "s"} delivered between co-located robots`,
      kind: "communication",
    });
  }

  for (const movement of result.movementDetails) {
    events.push({
      id: `${result.round}-robot-${movement.robotId}`,
      round: result.round,
      text: `Robot #${movement.robotId} moved through local port ${movement.outgoingPort}`,
      kind: "movement",
      port: movement.outgoingPort,
      robotId: movement.robotId,
    });
  }

  if (events.length === 0) {
    events.push({
      id: `${result.round}-idle`,
      round: result.round,
      text: "No messages or movements this round",
      kind: "idle",
    });
  }

  return events;
}

export function SimulatorPage({ simulation, gridSize, algorithmMode, onBack, onReset }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [showPorts, setShowPorts] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  const algorithm = useMemo(
    () => new NonFaultyAlgorithm({ n: gridSize * gridSize }),
    [gridSize]
  );
  const engine = useMemo(
    () => new SimulationEngine(simulation, algorithm),
    [simulation, algorithm]
  );

  const nodes = simulation.grid.getAllNodes();
  const selectedNode = selectedNodeId === null
    ? null
    : nodes.find((node) => node.id === selectedNodeId) ?? null;
  const stageNumber = algorithm.getStage(simulation.round);
  const stageLabel = stageNumber === 1
    ? "1 · Move to corners"
    : stageNumber === 2
      ? "2 · Gather at minimum-ID corner"
      : "3 · Disperse gathered robots";
  const isFaultyMode = algorithmMode === "faulty";
  const occupiedNodes = nodes.filter((node) => node.robots.length > 0).length;

  const executeStep = useCallback(() => {
    if (isFaultyMode) return;

    try {
      const previousStage = algorithm.getStage(simulation.round);
      const result = engine.step();
      const nextStage = algorithm.getStage(result.round);
      const events = describeStep(result, previousStage, nextStage).map((event) => {
        if (event.kind !== "movement") return event;
        const robot = simulation.robots.find((item) => item.id === event.robotId);
        return {
          ...event,
          text: `Robot #${event.robotId} moved through port ${event.port} to ${coordinateFor(robot.currentNode.id, gridSize)}`,
        };
      });

      setActivity((current) => [...events, ...current].slice(0, MAX_ACTIVITY_ITEMS));
      setError("");
    } catch (stepError) {
      setIsRunning(false);
      setError(stepError instanceof Error ? stepError.message : "The simulation stopped unexpectedly.");
    }
  }, [algorithm, engine, gridSize, isFaultyMode, simulation]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(executeStep, speed);
    return () => window.clearInterval(timer);
  }, [executeStep, isRunning, speed]);

  useEffect(() => {
    setIsRunning(false);
    setActivity([]);
    setError("");
    setSelectedNodeId(null);
    setSelectedRobotId(null);
  }, [simulation]);

  function reset() {
    setIsRunning(false);
    onReset();
  }

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" className="mb-2 text-sm text-foreground-muted hover:text-foreground" onClick={onBack}>← Configuration preview</button>
          <h2 className="text-xl font-medium tracking-tight">Simulation</h2>
          <p className="mt-1 text-sm text-foreground-muted">{gridSize} × {gridSize} grid · {simulation.robots.length} robots · {occupiedNodes} occupied nodes</p>
        </div>
      </div>

      <SimulationControls
        round={simulation.round}
        stage={stageLabel}
        isRunning={isRunning}
        speed={speed}
        onSpeedChange={(nextSpeed) => {
          if (SPEED_OPTIONS.includes(nextSpeed)) setSpeed(nextSpeed);
        }}
        onStep={executeStep}
        onToggleRun={() => setIsRunning((running) => !running)}
        onReset={reset}
        disabled={isFaultyMode || Boolean(error)}
      />

      {isFaultyMode ? (
        <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground-muted">Faulty-robot execution is not implemented yet. Return to the preview and select the non-faulty algorithm.</p>
      ) : null}
      {error ? <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">Simulation stopped: {error}</p> : null}
      {stageNumber === 3 && !isFaultyMode ? (
        <p className="mb-4 text-xs leading-relaxed text-foreground-muted">Stage 3 currently runs the simulator’s marker-assisted DFS fallback. It is not the paper’s paired-column procedure.</p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <GridPreview
            gridSize={gridSize}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            showPorts={showPorts}
            onTogglePorts={() => setShowPorts((value) => !value)}
          />
          <ActivityLog items={activity} />
        </div>

        <div className="space-y-4">
          <NodeInspector node={selectedNode} gridSize={gridSize} />
          <RobotInspector
            robots={simulation.robots}
            selectedRobotId={selectedRobotId}
            onSelectRobot={setSelectedRobotId}
            gridSize={gridSize}
          />
        </div>
      </div>
    </section>
  );
}

function ActivityLog({ items }) {
  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Simulation activity">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium">Activity</h3>
        <span className="text-xs tabular-nums text-foreground-muted">{items.length} recent events</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-foreground-muted">Step or run the simulation to see actual communication and movement events.</p>
      ) : (
        <ol className="max-h-72 divide-y divide-border overflow-y-auto px-4">
          {items.map((event) => (
            <li key={event.id} className="flex gap-4 py-2.5 text-sm">
              <span className="w-16 shrink-0 text-xs tabular-nums text-foreground-muted">Round {event.round}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
