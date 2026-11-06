import { BoundaryTraversal } from "./navigation/BoundaryTraversal.js";
import { StraightLineNavigation } from "./navigation/StraightLineNavigation.js";

const MEMORY_KEY = "nonFaultyStage3";
const LINE_KEY = "straightLineNavigation";
const STAGE1_KEY = "nonFaultyStage1";
const STAGE2_KEY = "nonFaultyStage2";

/**
 * Stage 3 uses a perimeter scout when the group cannot staff every column.
 * Otherwise, one pair surveys each column and reports only its vacancy count.
 * After quotas are assigned, the survey pair shares its local navigation data
 * with robots assigned to that column; the coordinator uses only the counts.
 */
export class Stage3 {
  constructor({ size } = {}) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Stage 3 requires a square grid size of at least 2.");
    }

    this.size = size;
    this.perimeterEdges = 4 * size - 4;
    this.lineNavigation = new StraightLineNavigation({ size });
  }

  createMessage(observation) {
    const state = observation.memory[MEMORY_KEY];

    if (
      state?.role === "root" &&
      observation.robotId === state.rootId &&
      state.phase === "dispatching"
    ) {
      return {
        type: "stage3-root-plan",
        reports: state.reports,
        fixedCornerSteps: state.fixedCornerSteps,
        assignments: state.assignments,
      };
    }

    if (
      state?.role === "root" &&
      state.phase === "broadcasting-column-route" &&
      state.pairIds?.includes(observation.robotId) &&
      state.route?.length
    ) {
      return {
        type: "stage3-column-navigation",
        columnIndex: state.columnIndex,
        occupiedPositions: state.occupiedPositions,
        route: state.route,
        routeStartIndex: state.routeStartIndex ?? 0,
      };
    }

    if (this.isStage2CornerSingleton(observation)) {
      return { type: "stage3-fixed-corner", robotId: observation.robotId };
    }

    if (observation.degree === 4 && this.isFixedInternalSingleton(observation)) {
      return { type: "stage3-fixed-internal", robotId: observation.robotId };
    }

    if (!state) return null;

    if (state.phase === "corner-report") {
      return {
        type: "stage3-corner-report",
        fixedCornerSteps: state.fixedCornerSteps,
      };
    }

    if (state.phase === "boundary-report") {
      return {
        type: "stage3-boundary-report",
        fixedCornerSteps: state.fixedCornerSteps,
      };
    }

    if (state.phase === "column-report") {
      state.reports = {
        ...(state.reports ?? {}),
        [state.columnIndex]: {
          emptyCount: this.getColumnEmptyCount(state),
        },
      };
      return {
        type: "stage3-column-report",
        columnIndex: state.columnIndex,
        emptyCount: this.getColumnEmptyCount(state),
      };
    }

    if (state.role === "column-pair" && state.phase === "scan-out") {
      return this.lineNavigation.createMessage(
        this.getPairObservation(observation, state),
        0
      );
    }

    return null;
  }

  compute(observation, inbox, round) {
    const state = observation.memory[MEMORY_KEY];

    const initialFixedCornerRoot = !state &&
      this.isFixedCorner(observation) &&
      observation.coLocatedRobotIds.length > 1 &&
      observation.robotId === Math.min(...observation.coLocatedRobotIds);
    const activeFixedCornerRoot = state?.role === "root" &&
      observation.robotId === state.rootId;

    if (
      (this.isFixedCorner(observation) && !initialFixedCornerRoot && !activeFixedCornerRoot) ||
      this.isFixedInternalSingleton(observation)
    ) {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "fixed",
            phase: "placed",
          },
        },
      };
    }

    if (!state) return this.initialize(observation);

    if (state.role === "corner-scout") {
      return this.advanceCornerSurvey(observation, inbox, state);
    }

    if (state.role === "boundary-pair") {
      return this.advanceBoundarySurvey(observation, inbox, state);
    }

    if (state.role === "column-pair") {
      return this.advanceColumnSurvey(observation, inbox, state, round);
    }

    if (state.role === "root") {
      return this.advanceRoot(observation, inbox, state);
    }

    if (state.role === "perimeter-robot") {
      return this.advancePerimeterPlacement(observation, state);
    }

    if (state.role === "column-robot") {
      return this.advanceColumnPlacement(observation, state);
    }

    return { action: { type: "stay" } };
  }

  initialize(observation) {
    // Stage 1 singletons remain at internal nodes. They advertise their
    // occupancy when a survey pair reaches them.
    const isRootCornerCoordinator = this.isFixedCorner(observation) &&
      observation.coLocatedRobotIds.length > 1 &&
      observation.robotId === Math.min(...observation.coLocatedRobotIds);
    if (this.isPreviouslySettled(observation) && !isRootCornerCoordinator) {
      return {
        action: { type: "stay" },
        memoryUpdates: { [MEMORY_KEY]: { role: "fixed", phase: "placed" } },
      };
    }

    if (observation.degree !== 2 || observation.coLocatedRobotIds.length < 2) {
      return { action: { type: "stay" } };
    }

    const groupIds = [...new Set(observation.coLocatedRobotIds)].sort((a, b) => a - b);
    const rootId = groupIds[0];
    const firstPort = [...observation.ports].sort((a, b) => a - b)[0];

    // A column survey needs one pair per column plus the coordinator. Smaller
    // groups use the perimeter path because they cannot staff every survey.
    const smallCase = groupIds.length < 2 * this.size + 1;
    if (!smallCase) {
      const surveyState = {
        groupIds,
        rootId,
        surveyPairOffset: 0,
        reports: {},
      };
      const pair = this.getSurveyPair(surveyState, observation.robotId);
      if (pair) {
        if (pair.columnIndex === 0 || pair.columnIndex === this.size - 1) {
          return this.startBoundaryColumnSurvey(
            observation,
            { ...surveyState, firstPort },
            pair
          );
        }
        return this.startColumnSurvey(
          observation,
          { ...surveyState, firstPort },
          pair
        );
      }

      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "root",
            phase: "waiting-for-columns",
            groupIds,
            rootId,
            firstPort,
            fixedCornerSteps: [],
            reports: {},
            smallCase: false,
            surveyPairOffset: 0,
          },
        },
      };
    }

    const scoutId = groupIds[groupIds.length - 1];

    if (observation.robotId === scoutId) {
      const start = BoundaryTraversal.start(observation, firstPort, {
        remainingEdges: this.perimeterEdges,
      });
      return {
        action: start.action,
        memoryUpdates: {
          [MEMORY_KEY]: {
            role: "corner-scout",
            phase: "survey-corners",
            groupIds,
            rootId,
            firstPort,
            fixedCornerSteps: [],
            // The returning scout becomes an ordinary member of the root
            // group after its survey. Preserve the branch decision so it
            // takes its own ID-ranked perimeter slot instead of waiting for
            // column reports that this small-group case will never request.
            smallCase: true,
            walker: start.state,
          },
        },
      };
    }

    return {
      action: { type: "stay" },
      memoryUpdates: {
        [MEMORY_KEY]: {
          role: "root",
          phase: "waiting-for-corners",
          groupIds,
          rootId,
          firstPort,
          fixedCornerSteps: null,
          reports: {},
            smallCase: true,
        },
      },
    };
  }

  advanceCornerSurvey(observation, inbox, previousState) {
    const state = structuredClone(previousState);
    const result = BoundaryTraversal.advance(observation, state.walker);
    state.walker = result.state;

    if (
      result.edgeCompleted &&
      observation.degree === 2 &&
      !observation.coLocatedRobotIds.includes(state.rootId) &&
      inbox.some((message) => message.payload?.type === "stage3-fixed-corner")
    ) {
      state.fixedCornerSteps = [
        ...new Set([...state.fixedCornerSteps, state.walker.completedEdges]),
      ];
    }

    if (result.state.phase === "arrived") {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            role: "root",
            phase: "corner-report",
          reports: {},
          },
        },
      };
    }

    return {
      action: result.action,
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }

  advanceBoundarySurvey(observation, inbox, previousState) {
    const state = structuredClone(previousState);
    if (state.phase === "boundary-report") {
      return {
        action: { type: "stay" },
        memoryUpdates: {
          [MEMORY_KEY]: { ...state, role: "root", phase: "waiting-for-columns" },
        },
      };
    }

    const result = BoundaryTraversal.advance(observation, state.walker);
    state.walker = result.state;
    if (
      result.edgeCompleted &&
      observation.degree === 2 &&
      !observation.coLocatedRobotIds.includes(state.rootId) &&
      inbox.some((message) => message.payload?.type === "stage3-fixed-corner")
    ) {
      state.fixedCornerSteps = [
        ...new Set([...state.fixedCornerSteps, state.walker.completedEdges]),
      ];
    }

    if (result.state.phase === "arrived") {
      state.phase = "boundary-report";
      return {
        action: { type: "stay" },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    return {
      action: result.action,
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }

  advanceRoot(observation, inbox, previousState) {
    const state = structuredClone(previousState);
    let rootPlan = null;

    for (const message of inbox) {
      const payload = message.payload;
      if (payload?.type === "stage3-corner-report") {
        state.fixedCornerSteps = [...payload.fixedCornerSteps];
      }
      if (payload?.type === "stage3-boundary-report") {
        state.fixedCornerSteps = [...payload.fixedCornerSteps];
      }
      if (payload?.type === "stage3-column-report") {
        state.reports[payload.columnIndex] = {
          emptyCount: payload.emptyCount,
        };
      }
      if (payload?.type === "stage3-root-plan") rootPlan = payload;
    }

    if (
      rootPlan &&
      observation.robotId !== state.rootId &&
      !["dispatching", "broadcasting-column-route"].includes(state.phase)
    ) {
      state.reports = structuredClone(rootPlan.reports);
      state.fixedCornerSteps = [...rootPlan.fixedCornerSteps];
      state.assignments = structuredClone(rootPlan.assignments);
      if (state.route?.length && state.pairIds?.includes(observation.robotId)) {
        state.phase = "broadcasting-column-route";
        return this.stay(state);
      }
      state.phase = "dispatching";
    }

    if (
      !["dispatching", "broadcasting-column-route"].includes(state.phase) &&
      (state.phase === "corner-report" || state.fixedCornerSteps !== null)
    ) {
      state.phase = "waiting-for-columns";
    }

    if (state.fixedCornerSteps === null) {
      return this.stay(state);
    }

    const perimeterSlots = this.getFreePerimeterSteps(state.fixedCornerSteps);
    const mobileIds = state.groupIds.filter((id) => id !== state.rootId);

    if (state.phase === "waiting-for-corners") {
      return this.stay(state);
    }

    if (state.phase === "waiting-for-columns") {
      if (state.smallCase && mobileIds.length <= perimeterSlots.length) {
        const rank = mobileIds.indexOf(observation.robotId);
        if (rank < 0) return this.stay(state);

        return this.startPerimeterPlacement(
          observation,
          state,
          perimeterSlots[rank]
        );
      }

      const requiredReports = state.smallCase ? this.size - 2 : this.size;
      if (Object.keys(state.reports).length < requiredReports) {
        const pair = this.getSurveyPair(state, observation.robotId);
        if (!pair) return this.stay(state);
        if (
          !state.smallCase &&
          (pair.columnIndex === 0 || pair.columnIndex === this.size - 1)
        ) {
          return this.startBoundaryColumnSurvey(observation, state, pair);
        }
        return this.startColumnSurvey(observation, state, pair);
      }

      // The minimum-ID root is the single authority for the plan. Column
      // survey pairs arrive with different local memories; broadcast one
      // complete plan before any robot leaves so every member uses identical
      // vacancy counts and ID assignments.
      if (observation.robotId !== state.rootId) return this.stay(state);
      state.assignments = this.createColumnAssignments(
        state.groupIds,
        state.rootId,
        perimeterSlots,
        state.reports,
        state.smallCase
      );
      state.phase = "dispatching";
      return this.stay(state);
    }

    if (state.phase === "dispatching") {
      const assignment = state.assignments?.[observation.robotId];
      if (!assignment) return this.stay(state);

      if (assignment.kind === "perimeter") {
        return this.startPerimeterPlacement(
          observation,
          { ...state, role: "perimeter-robot" },
          assignment.targetStep
        );
      }

      return this.startColumnPlacementFromPlan(observation, inbox, state, assignment);
    }

    if (state.phase === "broadcasting-column-route") {
      const assignment = state.assignments?.[observation.robotId];
      if (!assignment) {
        state.phase = "dispatching";
        return this.stay(state);
      }

      if (assignment.kind === "perimeter") {
        return this.startPerimeterPlacement(
          observation,
          { ...state, role: "perimeter-robot" },
          assignment.targetStep
        );
      }

      const navigation = state.columnIndex === assignment.columnIndex
        ? state
        : inbox.find((message) =>
            message.payload?.type === "stage3-column-navigation" &&
            message.payload.columnIndex === assignment.columnIndex
          )?.payload;
      if (!navigation?.route?.length) {
        state.phase = "dispatching";
        return this.stay(state);
      }

      return this.startColumnPlacementFromPlan(
        observation,
        inbox,
        state,
        assignment,
        navigation
      );
    }

    return this.stay(state);
  }

  startPerimeterPlacement(observation, state, targetStep) {
    const walker = BoundaryTraversal.start(observation, state.firstPort, {
      remainingEdges: targetStep,
    });
    return {
      action: walker.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          role: "perimeter-robot",
          phase: "walking-perimeter",
          targetStep,
          walker: walker.state,
        },
      },
    };
  }

  advancePerimeterPlacement(observation, previousState) {
    const state = structuredClone(previousState);
    if (state.phase === "placed") {
      return { action: { type: "stay" } };
    }

    const result = BoundaryTraversal.advance(observation, state.walker);
    const placed = result.state.phase === "arrived";

    return {
      action: placed ? { type: "stay" } : result.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          phase: placed ? "placed" : "walking-perimeter",
          walker: result.state,
        },
      },
    };
  }

  getSurveyPair(state, robotId) {
    const mobileIds = state.groupIds.filter((id) => id !== state.rootId);
    const firstColumn = state.smallCase ? 1 : 0;
    const lastColumn = state.smallCase ? this.size - 2 : this.size - 1;
    const numberOfColumns = lastColumn - firstColumn + 1;
    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      if (state.reports[columnIndex]) continue;
      const columnRank = columnIndex - firstColumn;
      const offset = state.surveyPairOffset ?? 0;
      const pairIds = [
        mobileIds[offset + columnRank],
        mobileIds[offset + numberOfColumns + columnRank],
      ].filter(Number.isInteger);
      if (pairIds.length === 2 && pairIds.includes(robotId)) {
        return { columnIndex, pairIds };
      }
    }
    return null;
  }

  startColumnSurvey(observation, state, pair) {
    const walker = BoundaryTraversal.start(observation, state.firstPort, {
      remainingEdges: pair.columnIndex,
    });

    return {
      action: walker.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          role: "column-pair",
          phase: "walking-to-column",
          // Stage 1 may have left this robot with an idle/searching line
          // protocol from a different group. A survey pair must discover the
          // column direction afresh from its own entry node.
          [LINE_KEY]: null,
          pairIds: pair.pairIds,
          columnIndex: pair.columnIndex,
          boundaryArrivalPort: null,
          occupiedPositions: [],
          route: [],
          countedAtNode: false,
          walker: walker.state,
        },
      },
    };
  }

  startBoundaryColumnSurvey(observation, state, pair) {
    const isFirstColumn = pair.columnIndex === 0;
    const sidePort = isFirstColumn
      ? observation.ports.find((port) => port !== state.firstPort)
      : state.firstPort;
    if (!Number.isInteger(sidePort)) {
      throw new Error(`Could not choose a boundary route for column ${pair.columnIndex}.`);
    }

    const walker = BoundaryTraversal.start(observation, sidePort, {
      remainingEdges: isFirstColumn ? this.size - 1 : this.size - 1,
    });
    return {
      action: walker.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          role: "column-pair",
          phase: isFirstColumn ? "survey-side-column" : "approach-last-column",
          pairIds: pair.pairIds,
          columnIndex: pair.columnIndex,
          boundarySide: isFirstColumn ? "first" : "last",
          routeStartIndex: isFirstColumn ? 0 : this.size - 1,
          occupiedPositions: [],
          route: [{ fromPort: sidePort, toPort: null }],
          pendingBoundaryRouteArrival: true,
          walker: walker.state,
        },
      },
    };
  }

  advanceColumnSurvey(observation, inbox, previousState, round) {
    const state = structuredClone(previousState);

    if (["approach-last-column", "survey-side-column"].includes(state.phase)) {
      return this.advanceBoundaryColumnSurvey(observation, inbox, state);
    }

    if (state.phase === "return-boundary-report") {
      const result = BoundaryTraversal.advance(observation, state.walker);
      state.walker = result.state;
      if (result.state.phase === "arrived") state.phase = "column-report";
      return {
        action: result.action,
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "walking-to-column") {
      const result = BoundaryTraversal.advance(observation, state.walker);
      state.walker = result.state;
      if (result.state.phase === "arrived") {
        state.phase = "probe-entry";
        state.boundaryArrivalPort = observation.memory.incomingPort;
      }
      return {
        action: result.action,
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "probe-entry" || state.phase === "probe-entry-again") {
      const candidates = observation.ports
        .filter((port) => port !== observation.memory.incomingPort)
        .sort((a, b) => a - b);
      const probePort = state.phase === "probe-entry"
        ? candidates[0]
        : candidates.find((port) => port !== state.firstEntryProbe);
      if (probePort === undefined) {
        throw new Error("Could not identify an inward column port.");
      }

      state.firstEntryProbe ??= probePort;
      state.phase = "entry-result";
      state.pendingEntryPort = probePort;
      return {
        action: { type: "move", port: probePort },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "entry-result") {
      if (observation.degree === 3 || observation.degree === 2) {
        const returnPort = observation.memory.incomingPort;
        if (returnPort === undefined) {
          throw new Error("Column entry probe has no return port.");
        }
        state.phase = "entry-returned";
        return {
          action: { type: "move", port: returnPort },
          memoryUpdates: { [MEMORY_KEY]: state },
        };
      }

      if (observation.degree !== 4) {
        throw new Error(`Column survey entered a degree-${observation.degree} node.`);
      }

      state.route = [{
        fromPort: state.pendingEntryPort,
        toPort: observation.memory.incomingPort,
      }];
      state.phase = "scan-out";
      state.countedAtNode = false;
      return this.scanColumnNode(observation, inbox, state, round);
    }

    if (state.phase === "entry-returned") {
      const candidates = observation.ports
        .filter((port) =>
          port !== observation.memory.incomingPort &&
          port !== state.boundaryArrivalPort
        )
        .sort((a, b) => a - b);
      if (candidates.length !== 1) {
        throw new Error("Could not identify the inward port after a boundary probe.");
      }
      state.phase = "entry-result";
      state.pendingEntryPort = candidates[0];
      return {
        action: { type: "move", port: candidates[0] },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "scan-out") {
      if (state.pendingRouteArrival && observation.memory.incomingPort !== undefined) {
        state.route[state.route.length - 1].toPort = observation.memory.incomingPort;
        state.pendingRouteArrival = false;
      }

      if (
        observation.degree === 3 &&
        observation.memory[LINE_KEY]?.phase !== "idle"
      ) {
        // The straight-line direction finder visits degree-3 nodes as part of
        // its 27-path search. Such a visit is not the end of the column. Let
        // its DFS backtrack/continue; only an idle pair has completed its
        // direction decision and actually moved to the column boundary.
        return this.scanColumnNode(observation, inbox, state, round);
      }

      if (observation.degree === 3) {
        const returnPort = observation.memory.incomingPort;
        if (returnPort === undefined) {
          throw new Error("Column scan reached a boundary without a return port.");
        }
        state.phase = "scan-back";
        // First step back to the last internal node. The final route entry
        // describes the edge from that node to this boundary, so it has
        // already been retraced by this move. Start with the preceding edge.
        state.routeCursor = state.route.length - 2;
        return {
          action: { type: "move", port: returnPort },
          memoryUpdates: { [MEMORY_KEY]: state },
        };
      }

      return this.scanColumnNode(observation, inbox, state, round);
    }

    if (state.phase === "scan-back") {
      if (observation.degree === 3) {
        state.phase = "return-to-root";
        state.walker = {
          phase: "at-boundary",
          pendingMove: false,
          pendingKind: "boundary",
          firstPort: null,
          lastBoundaryPort: state.boundaryArrivalPort,
          remainingEdges: this.perimeterEdges - state.columnIndex,
          completedEdges: 0,
        };
        return this.advanceColumnSurvey(observation, inbox, state, round);
      }

      if (state.routeCursor < 0) {
        throw new Error(
          `Column route is incomplete at an internal node (recorded ${state.route.length} edges; expected to reach the entry boundary).`
        );
      }

      const reverseEdge = state.route[state.routeCursor];
      if (!Number.isInteger(reverseEdge?.toPort)) {
        throw new Error(
          `Column route edge ${state.routeCursor} has no reciprocal port; route has ${state.route.length} edges.`
        );
      }

      const port = reverseEdge.toPort;
      state.routeCursor -= 1;
      return {
        action: { type: "move", port },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "return-to-root") {
      if (
        observation.degree === 2 &&
        observation.coLocatedRobotIds.includes(state.rootId)
      ) {
        state.phase = "column-report";
        return { action: { type: "stay" }, memoryUpdates: { [MEMORY_KEY]: state } };
      }

      const result = BoundaryTraversal.advance(observation, state.walker);
      state.walker = result.state;
      if (result.state.phase === "arrived") state.phase = "column-report";
      return {
        action: result.action,
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "column-report") {
      return {
        action: { type: "stay" },
        memoryUpdates: { [MEMORY_KEY]: { ...state, role: "root", phase: "waiting-for-columns" } },
      };
    }

    return { action: { type: "stay" } };
  }

  advanceBoundaryColumnSurvey(observation, inbox, state) {
    if (
      state.pendingBoundaryRouteArrival &&
      observation.memory.incomingPort !== undefined
    ) {
      state.route[state.route.length - 1].toPort = observation.memory.incomingPort;
      state.pendingBoundaryRouteArrival = false;
    }

    if (state.pendingBoundaryProbePort !== undefined) {
      if (
        (observation.degree === 2 || observation.degree === 3) &&
        observation.memory.incomingPort !== undefined
      ) {
        state.route.push({
          fromPort: state.pendingBoundaryProbePort,
          toPort: observation.memory.incomingPort,
        });
      }
      delete state.pendingBoundaryProbePort;
    }

    const result = BoundaryTraversal.advance(observation, state.walker);
    state.walker = result.state;

    if (
      result.edgeCompleted &&
      observation.degree === 2 &&
      inbox.some((message) => message.payload?.type === "stage3-fixed-corner")
    ) {
      const position = state.phase === "approach-last-column"
        ? 0
        : result.state.completedEdges;
      state.occupiedPositions = [
        ...new Set([...state.occupiedPositions, position]),
      ];
    }

    if (result.state.phase === "arrived") {
      if (state.phase === "approach-last-column") {
        const turnPort = observation.ports.find(
          (port) => port !== observation.memory.incomingPort
        );
        if (turnPort === undefined) {
          throw new Error("Could not turn onto the last boundary column.");
        }

        const sideWalker = BoundaryTraversal.start(observation, turnPort, {
          remainingEdges: this.size - 1,
        });
        state.phase = "survey-side-column";
        state.walker = sideWalker.state;
        state.route.push({ fromPort: turnPort, toPort: null });
        state.pendingBoundaryRouteArrival = true;
        return {
          action: sideWalker.action,
          memoryUpdates: { [MEMORY_KEY]: state },
        };
      }

      // Reverse the surveyed side by taking the port we just entered through.
      // BoundaryTraversal then follows the perimeter in that reverse direction.
      const returnPort = observation.memory.incomingPort;
      if (returnPort === undefined) {
        throw new Error("Boundary-column pair has no port back toward the root corner.");
      }
      const returnDistance = state.columnIndex === 0
        ? this.size - 1
        : 2 * (this.size - 1);
      const returnWalk = BoundaryTraversal.start(observation, returnPort, {
        remainingEdges: returnDistance,
      });
      state.phase = "return-boundary-report";
      state.walker = returnWalk.state;
      return {
        action: returnWalk.action,
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (
      result.action?.type === "move" &&
      result.state.pendingMove &&
      result.state.pendingKind === "boundary"
    ) {
      state.route.push({ fromPort: result.action.port, toPort: null });
      state.pendingBoundaryRouteArrival = true;
    }
    if (
      result.action?.type === "move" &&
      result.state.pendingMove &&
      result.state.pendingKind === "probe"
    ) {
      state.pendingBoundaryProbePort = result.action.port;
    }

    return {
      action: result.action,
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }

  scanColumnNode(observation, inbox, state, round) {
    const hasFixedRobot = inbox.some(
      (message) => message.payload?.type === "stage3-fixed-internal"
    );
    const position = state.route.length;
    const pairIsTogether = state.pairIds.every((id) =>
      observation.coLocatedRobotIds.includes(id)
    );
    if (pairIsTogether && hasFixedRobot) {
      state.occupiedPositions = [...new Set([...state.occupiedPositions, position])];
    }

    const pairObservation = this.getPairObservation(observation, state);
    const pairInbox = inbox.filter((message) => state.pairIds.includes(message.fromRobotId));
    const previousLineState = observation.memory[LINE_KEY];
    const decision = this.lineNavigation.compute(pairObservation, pairInbox, round);
    const nextLineState = decision.memoryUpdates?.[LINE_KEY];
    const completedStraightStep =
      ["waiting", "searching", "returning-home"].includes(previousLineState?.phase) &&
      nextLineState?.phase === "idle" &&
      decision.action?.type === "move";

    if (completedStraightStep) {
      state.route.push({ fromPort: decision.action.port, toPort: null });
      state.pendingRouteArrival = true;
    }

    return {
      ...decision,
      memoryUpdates: {
        ...decision.memoryUpdates,
        [MEMORY_KEY]: state,
      },
    };
  }

  getPairObservation(observation, state) {
    return {
      ...observation,
      coLocatedRobotIds: state.pairIds.filter((id) =>
        observation.coLocatedRobotIds.includes(id)
      ),
    };
  }

  getColumnEmptyCount(state) {
    const totalPositions = state.smallCase
      ? this.size - 2
      : state.columnIndex === 0
        ? this.size - 1
        : this.size;
    return Math.max(0, totalPositions - state.occupiedPositions.length);
  }

  getVacantColumnPositions(columnIndex, occupiedPositions, smallCase) {
    const occupied = new Set(occupiedPositions ?? []);
    const firstPosition = smallCase ? 1 : columnIndex === 0 ? 1 : 0;
    const lastPosition = smallCase ? this.size - 2 : this.size - 1;
    const positions = [];

    for (let position = firstPosition; position <= lastPosition; position += 1) {
      if (!occupied.has(position)) positions.push(position);
    }
    return positions;
  }

  createColumnAssignments(groupIds, rootId, perimeterSlots, reports, smallCase) {
    const assignments = {};
    const mobileIds = groupIds.filter((id) => id !== rootId).sort((a, b) => a - b);
    let cursor = 0;

    if (smallCase) {
      for (let rank = 0; rank < perimeterSlots.length && cursor < mobileIds.length; rank += 1) {
        assignments[mobileIds[cursor]] = {
          kind: "perimeter",
          targetStep: perimeterSlots[rank],
        };
        cursor += 1;
      }
    }

    const firstColumn = smallCase ? 1 : 0;
    const lastColumn = smallCase ? this.size - 2 : this.size - 1;
    const columnPlans = [];
    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      const report = reports[columnIndex];
      if (!Number.isInteger(report?.emptyCount)) continue;
      columnPlans.push({
        columnIndex,
        vacantCount: report.emptyCount,
        assignedCount: 0,
      });
    }

    // Assign at most one robot per column on each pass. This uses IDs in
    // increasing order while avoiding filling early columns before later
    // columns receive any robots.
    while (cursor < mobileIds.length) {
      let assignedOnPass = false;
      for (const plan of columnPlans) {
        if (
          cursor >= mobileIds.length ||
          plan.assignedCount >= plan.vacantCount
        ) {
          continue;
        }

        assignments[mobileIds[cursor]] = {
          kind: !smallCase &&
            (plan.columnIndex === 0 || plan.columnIndex === this.size - 1)
            ? "boundary-column"
            : "column",
          columnIndex: plan.columnIndex,
          rank: plan.assignedCount,
          vacantCount: plan.vacantCount,
        };
        plan.assignedCount += 1;
        cursor += 1;
        assignedOnPass = true;
      }

      if (!assignedOnPass) break;
    }

    if (cursor < mobileIds.length) {
      throw new Error(
        `Stage 3 assigned ${cursor} of ${mobileIds.length} available robots to column vacancies and free perimeter positions.`
      );
    }
    return assignments;
  }

  startColumnPlacementFromPlan(
    observation,
    inbox,
    state,
    assignment,
    navigationOverride = null
  ) {
    const navigation = navigationOverride ??
      (state.columnIndex === assignment.columnIndex && state.route?.length
        ? state
        : inbox.find((message) =>
            message.payload?.type === "stage3-column-navigation" &&
            message.payload.columnIndex === assignment.columnIndex
          )?.payload);
    if (!navigation?.route?.length) return this.stay(state);

    const vacantPositions = this.getVacantColumnPositions(
      assignment.columnIndex,
      navigation.occupiedPositions,
      state.smallCase
    );
    if (vacantPositions.length !== assignment.vacantCount) {
      throw new Error(
        `Column ${assignment.columnIndex} reported ${assignment.vacantCount} vacancies but its navigation pair found ${vacantPositions.length}.`
      );
    }

    const targetPosition = vacantPositions[assignment.rank];
    if (!Number.isInteger(targetPosition)) {
      throw new Error(
        `Column ${assignment.columnIndex} has no vacant position for assignment rank ${assignment.rank}.`
      );
    }

    return this.startColumnPlacement(observation, state, {
      ...assignment,
      targetPosition,
      targetRoutePosition: assignment.columnIndex === this.size - 1
        ? (navigation.routeStartIndex ?? 0) + targetPosition
        : targetPosition,
      route: navigation.route,
    });
  }

  startColumnPlacement(observation, state, assignment) {
    if (assignment.kind === "boundary-column") {
      return {
        action: { type: "move", port: assignment.route[0].fromPort },
        memoryUpdates: {
          [MEMORY_KEY]: {
            ...state,
            role: "column-robot",
            phase: "following-column-route",
            columnIndex: assignment.columnIndex,
            targetPosition: assignment.targetRoutePosition,
            route: structuredClone(assignment.route),
            routeStep: 1,
          },
        },
      };
    }

    const walker = BoundaryTraversal.start(observation, state.firstPort, {
      remainingEdges: assignment.columnIndex,
    });
    return {
      action: walker.action,
      memoryUpdates: {
        [MEMORY_KEY]: {
          ...state,
          role: "column-robot",
          phase: "walking-to-column",
          columnIndex: assignment.columnIndex,
          targetPosition: assignment.targetPosition,
          route: structuredClone(assignment.route),
          routeStep: 0,
          walker: walker.state,
        },
      },
    };
  }

  advanceColumnPlacement(observation, previousState) {
    const state = structuredClone(previousState);

    if (state.phase === "walking-to-column") {
      const result = BoundaryTraversal.advance(observation, state.walker);
      state.walker = result.state;
      if (result.state.phase === "arrived") {
        state.phase = state.targetPosition === 0 ? "placed" : "enter-column";
      }
      return {
        action: state.phase === "placed" ? { type: "stay" } : result.action,
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "enter-column") {
      if (state.targetPosition === 0) {
        return {
          action: { type: "stay" },
          memoryUpdates: { [MEMORY_KEY]: { ...state, phase: "placed" } },
        };
      }
      state.phase = "following-column-route";
      state.routeStep = 1;
      return {
        action: { type: "move", port: state.route[0].fromPort },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    if (state.phase === "following-column-route") {
      if (state.routeStep === state.targetPosition) {
        return {
          action: { type: "stay" },
          memoryUpdates: { [MEMORY_KEY]: { ...state, phase: "placed" } },
        };
      }

      const nextEdge = state.route[state.routeStep];
      if (!nextEdge) {
        throw new Error("Stage 3 column route ended before the assigned node.");
      }

      state.routeStep += 1;
      return {
        action: { type: "move", port: nextEdge.fromPort },
        memoryUpdates: { [MEMORY_KEY]: state },
      };
    }

    return { action: { type: "stay" } };
  }

  isPreviouslySettled(observation) {
    return observation.memory[STAGE1_KEY]?.status === "settled-singleton" ||
      observation.memory[STAGE2_KEY]?.role === "singleton-corner";
  }

  isFixedCorner(observation) {
    return observation.degree === 2 &&
      observation.coLocatedRobotIds.length === 1 &&
      this.isStage2CornerSingleton(observation);
  }

  isStage2CornerSingleton(observation) {
    return observation.degree === 2 &&
      observation.memory[STAGE2_KEY]?.role === "singleton-corner";
  }

  isFixedInternalSingleton(observation) {
    return observation.degree === 4 &&
      observation.memory[STAGE1_KEY]?.status === "settled-singleton";
  }

  getFreePerimeterSteps(fixedCornerSteps) {
    const fixed = new Set(fixedCornerSteps ?? []);
    const steps = [];
    for (let step = 1; step < this.perimeterEdges; step += 1) {
      if (!fixed.has(step)) steps.push(step);
    }
    return steps;
  }

  stay(state) {
    return {
      action: { type: "stay" },
      memoryUpdates: { [MEMORY_KEY]: state },
    };
  }
}
