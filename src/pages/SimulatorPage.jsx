import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridPreview } from "../components/simulator/GridPreview.jsx";
import { SimulationSummary } from "../components/simulator/SimulationSummary.jsx";
import { NodeInspector } from "../components/simulator/NodeInspector.jsx";
import { RobotInspector } from "../components/simulator/RobotInspector.jsx";
import { SimulationControls } from "../components/simulator/SimulationControls.jsx";
import { StageProgress } from "../components/simulator/StageProgress.jsx";
import { coordinateFor } from "../components/simulator/gridPresentation.js";
import { SimulationEngine } from "../simulation/engine/SimulationEngine.js";
import { NonFaultyAlgorithm } from "../simulation/algorithms/nonFaulty/NonFaultyAlgorithm.js";
import { FaultyAlgorithm } from "../simulation/algorithms/faulty/FaultyAlgorithm.js";

const SPEED_OPTIONS = [120, 400, 1000];
const MAX_ACTIVITY_ITEMS = 120;

function describeStep(result, previousStage, nextStage) {
  const events = [];
  const messageCount = Object.values(result.inboxes).reduce(
    (count, inbox) => count + inbox.length,
    0
  );

  if (result.crashedRobotIds?.length > 0) {
    for (const crashedId of result.crashedRobotIds) {
      events.push({
        id: `${result.round}-crash-${crashedId}`,
        round: result.round,
        text: `Robot ${crashedId} suffered a crash fault! (Robot removed/inactive)`,
        kind: "fault",
      });
    }
  }

  if (result.stageTransition) {
    events.push({
      id: `${result.round}-stage-complete`,
      round: result.round,
      text: `Stage ${result.stageTransition.fromStage} completed. Round ${result.stageTransition.fromRound} advanced to ${result.stageTransition.toRound}.`,
      kind: "stage",
    });
  }

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

  const columnReports = new Map();
  const stage3Plans = new Map();
  for (const inbox of Object.values(result.inboxes)) {
    for (const message of inbox) {
      const payload = message.payload;
      if (payload?.type === "stage3-column-report") {
        columnReports.set(payload.columnIndex, payload);
      } else if (payload?.type === "stage3-root-plan") {
        const key = Object.keys(payload.assignments ?? {}).sort().join(",");
        stage3Plans.set(key, payload);
      } else if (payload?.type === "faulty-straight-direction") {
        events.push({
          id: `${result.round}-faulty-straight-${message.fromRobotId}`,
          round: result.round,
          text: `Scout ${message.fromRobotId} reported straight-line port ${payload.port} to waiting base`,
          kind: "stage",
        });
      } else if (payload?.type === "faulty-stage2-target") {
        events.push({
          id: `${result.round}-faulty-target-${message.fromRobotId}`,
          round: result.round,
          text: `Seeker ${message.fromRobotId} reported minimum ID ${payload.targetId}; group migrating to winner corner`,
          kind: "stage",
        });
      } else if (payload?.type === "faulty-stage3-plan") {
        events.push({
          id: `${result.round}-faulty-plan-${payload.rootId}`,
          round: result.round,
          text: `Root ${payload.rootId} dispatched fault-tolerant dispersion plan`,
          kind: "stage",
        });
      }
    }
  }

  for (const [columnIndex, report] of columnReports) {
    events.push({
      id: `${result.round}-stage3-column-${columnIndex}`,
      round: result.round,
      text: `Stage 3 survey: column ${columnIndex + 1} has ${report.emptyCount} vacant node${report.emptyCount === 1 ? "" : "s"}.`,
      kind: "stage",
    });
  }

  if (stage3Plans.size > 0) {
    const plan = stage3Plans.values().next().value;
    events.push({
      id: `${result.round}-stage3-plan`,
      round: result.round,
      text: `Stage 3 dispatch plan: ${Object.keys(plan.reports ?? {}).length} columns surveyed; ${Object.keys(plan.assignments ?? {}).length} robots assigned.`,
      kind: "stage",
    });
  }

  for (const movement of result.movementDetails) {
    events.push({
      id: `${result.round}-robot-${movement.robotId}`,
      round: result.round,
      text: `Robot ${movement.robotId} moved through local port ${movement.outgoingPort}`,
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

export function SimulatorPage({ simulation, gridSize, algorithmMode, onReset, onFullscreenChange }) {
  const [selectedNodeId, setSelectedNodeId] = useState(0);
  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const history = useRef([]);
  const [historyLength, setHistoryLength] = useState(0);

  const isFaultyMode = algorithmMode === "faulty";

  const algorithm = useMemo(
    () => (isFaultyMode
      ? new FaultyAlgorithm({ n: gridSize * gridSize })
      : new NonFaultyAlgorithm({ n: gridSize * gridSize })),
    [gridSize, isFaultyMode]
  );
  const engine = useMemo(
    () => new SimulationEngine(simulation, algorithm),
    [simulation, algorithm]
  );

  const nodes = simulation.grid.getAllNodes();
  const selectedNode = selectedNodeId === null
    ? null
    : nodes.find((node) => node.id === selectedNodeId) ?? null;
  const stageProgress = algorithm.getStageProgress(simulation) ?? [];
  const stageNumber = stageProgress.find((stage) => !stage.complete)?.number ?? 3;
  const livingRobots = simulation.robots.filter((robot) => robot.alive);
  const occupiedNodes = nodes.filter((node) => node.robots.some((r) => r.alive)).length;
  const simulationComplete = algorithm.isStageComplete(simulation, 3);

  const crashRobot = useCallback((robotId) => {
    const robot = simulation.robots.find((item) => item.id === robotId);
    if (!robot || !robot.alive) return;

    history.current.push(captureSnapshot(simulation, algorithm));
    setHistoryLength(history.current.length);
    robot.crash();

    setActivity((current) => [
      {
        id: `${simulation.round}-manual-crash-${robotId}`,
        round: simulation.round,
        text: `Robot ${robotId} crashed (simulated crash fault).`,
        kind: "fault",
      },
      ...current,
    ].slice(0, MAX_ACTIVITY_ITEMS));
  }, [algorithm, simulation]);

  const executeStep = useCallback(() => {
    if (algorithm.isStageComplete(simulation, 3)) {
      setIsRunning(false);
      return;
    }

    try {
      const previousStage = algorithm.getStage(simulation.round);
      history.current.push(captureSnapshot(simulation, algorithm));
      setHistoryLength(history.current.length);
      const result = engine.step();
      const nextStage = algorithm.getStage(result.round);
      const events = describeStep(result, previousStage, nextStage).map((event) => {
        if (event.kind !== "movement") return event;
        const robot = simulation.robots.find((item) => item.id === event.robotId);
        return {
          ...event,
          text: `Robot ${event.robotId} moved through port ${event.port} to ${coordinateFor(robot.currentNode.id, gridSize)}`,
        };
      });

      setActivity((current) => [...events, ...current].slice(0, MAX_ACTIVITY_ITEMS));
      setError("");
    } catch (stepError) {
      history.current.pop();
      setHistoryLength(history.current.length);
      setIsRunning(false);
      setError(stepError instanceof Error ? stepError.message : "The simulation stopped unexpectedly.");
    }
  }, [algorithm, engine, gridSize, simulation]);

  const restoreHistoryEntry = useCallback((index) => {
    const snapshot = history.current[index];
    if (!snapshot) return;

    setIsRunning(false);
    restoreSnapshot(simulation, algorithm, snapshot);
    history.current = history.current.slice(0, index);
    setHistoryLength(history.current.length);
    setActivity((current) => current.filter((event) => event.round <= snapshot.round));
    setError("");
  }, [algorithm, simulation]);

  const previousStep = useCallback(() => {
    if (history.current.length === 0) return;
    restoreHistoryEntry(history.current.length - 1);
  }, [restoreHistoryEntry]);

  const selectStage = useCallback((stageNumber) => {
    const index = history.current.findIndex((snapshot) => snapshot.stage === stageNumber);
    if (index >= 0) restoreHistoryEntry(index);
  }, [restoreHistoryEntry]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(executeStep, speed);
    return () => window.clearInterval(timer);
  }, [executeStep, isRunning, speed]);

  function reset() {
    setIsRunning(false);
    onReset();
  }

  function changeFullscreen(nextValue) {
    setIsFullscreen(nextValue);
    onFullscreenChange?.(nextValue);
  }

  return (
    <section className={`${isFullscreen ? "fixed inset-0 z-50 overflow-y-auto bg-background" : "w-full"}`}>
      {isFaultyMode ? (
        <p className="mb-4 border border-border bg-surface px-4 py-2.5 text-xs leading-relaxed text-foreground-muted">
          Fault-tolerant mode active (O(√n log n) rounds, Section 4 of Banerjee et al.). Robots coordinate via halving scout/seeker groups and timeouts. You can crash any robot anytime using the <strong>💥 Crash robot</strong> button in Robot details.
        </p>
      ) : null}
      {simulationComplete ? (
        <p className="mb-4 border border-success/40 bg-surface px-4 py-3 text-sm text-success">Dispersion complete: every living robot occupies a distinct node.</p>
      ) : null}
      {error ? <p role="alert" className="mb-4 border border-danger/40 bg-surface px-4 py-3 text-sm text-danger">Simulation stopped: {error}</p> : null}

      <div className={`grid items-stretch gap-0 xl:grid-cols-[minmax(0,1fr)_17rem] ${isFullscreen ? "min-h-dvh" : ""}`}>
        <div className="min-w-0">
          <GridPreview
            gridSize={gridSize}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            selectedRobotId={selectedRobotId}
            onSelectNode={setSelectedNodeId}
            onSelectRobot={setSelectedRobotId}
            summary={(
              <SimulationSummary
                gridSize={gridSize}
                robotCount={livingRobots.length}
                occupiedNodes={occupiedNodes}
                algorithmMode={algorithmMode}
                variant="inline"
              />
            )}
            viewportReserve={isFullscreen ? 7 : 14}
            isFullscreen={isFullscreen}
            onFullscreenChange={changeFullscreen}
          />
          {!isFullscreen ? <ActivityLog items={activity} /> : null}
        </div>

        <div className="flex h-full min-h-full flex-col border-l border-border bg-surface">
          <SimulationControls
            compact
            round={simulation.round}
            isRunning={isRunning}
            speed={speed}
            onSpeedChange={(nextSpeed) => {
              if (SPEED_OPTIONS.includes(nextSpeed)) setSpeed(nextSpeed);
            }}
            onStep={executeStep}
            onPreviousStep={previousStep}
            previousDisabled={historyLength === 0}
            onToggleRun={() => {
              if (simulationComplete) return;
              setIsRunning((running) => !running);
            }}
            onReset={reset}
            disabled={isFaultyMode || Boolean(error) || simulationComplete}
          >
            {!isFaultyMode ? (
              <StageProgress
                stages={stageProgress}
                activeStage={stageNumber}
                onSelectStage={selectStage}
              />
            ) : null}
          </SimulationControls>
          {selectedNode ? <NodeInspector node={selectedNode} gridSize={gridSize} /> : null}
          <RobotInspector
            robots={simulation.robots}
            selectedRobotId={selectedRobotId}
            onSelectRobot={setSelectedRobotId}
            gridSize={gridSize}
            onCrashRobot={isFaultyMode ? crashRobot : null}
          />
        </div>
      </div>
    </section>
  );
}

function captureSnapshot(simulation, algorithm) {
  return {
    round: simulation.round,
    stage: algorithm.getStage(simulation.round),
    robots: simulation.robots.map((robot) => ({
      id: robot.id,
      nodeId: robot.currentNode?.id ?? null,
      alive: robot.alive,
      role: robot.role,
      memory: structuredClone(robot.memory),
      traversalHistory: structuredClone(robot.traversalHistory),
    })),
  };
}

function restoreSnapshot(simulation, algorithm, snapshot) {
  for (const node of simulation.grid.getAllNodes()) node.robots = [];

  for (const savedRobot of snapshot.robots) {
    const robot = simulation.robots.find((item) => item.id === savedRobot.id);
    robot.alive = savedRobot.alive;
    robot.role = savedRobot.role;
    robot.currentNode = savedRobot.nodeId === null
      ? null
      : simulation.grid.getNodeById(savedRobot.nodeId);
    robot.memory = structuredClone(savedRobot.memory);
    robot.traversalHistory = structuredClone(savedRobot.traversalHistory);
    if (robot.alive && robot.currentNode) robot.currentNode.robots.push(robot);
  }

  simulation.round = snapshot.round;
  algorithm.setStage?.(snapshot.stage);
}

function ActivityLog({ items }) {
  return (
    <details className="border border-border bg-surface" aria-label="Simulation activity">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-base font-bold">Activity</h3>
        <span className="text-xs tabular-nums text-foreground-muted">{items.length} recent events</span>
      </summary>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-foreground-muted">Step or run the simulation to see actual communication and movement events.</p>
      ) : (
        <ol className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border px-4">
          {items.map((event) => (
            <li key={event.id} className="flex gap-4 py-2.5 text-sm">
              <span className="w-16 shrink-0 text-xs tabular-nums text-foreground-muted">Round {event.round}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
