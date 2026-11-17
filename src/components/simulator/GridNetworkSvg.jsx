import { coordinateFor, getNodeType } from "./gridPresentation.js";
import {
  PITCH,
  PADDING,
  NODE_RADIUS,
  PORT_RADIUS,
  positionFor,
  directionForPort,
  getCurvedEdgePath,
} from "./gridGeometry.js";

const ROBOT_DOT_CLASSES = {
  clay: "fill-[#a95e43]",
  sage: "fill-[#657b60]",
  ochre: "fill-[#b58a4b]",
  blue: "fill-[#5b7885]",
  plum: "fill-[#806579]",
  olive: "fill-[#81804f]",
  rose: "fill-[#b06e70]",
  slate: "fill-[#697179]",
};

const ROBOT_COLORS = Object.keys(ROBOT_DOT_CLASSES);

function getEdges(nodes, size) {
  const edges = [];

  for (const node of nodes) {
    for (const [port, neighbour] of node.getNeighbours()) {
      if (node.id > neighbour.id) continue;

      const incomingPort = neighbour.getNeighbours()
        .find(([, adjacentNode]) => adjacentNode === node)?.[0];
      if (incomingPort === undefined) continue;

      const start = positionFor(node, size);
      const end = positionFor(neighbour, size);
      const outgoingDirection = directionForPort(port);
      const incomingDirection = directionForPort(incomingPort);

      edges.push({
        key: `${node.id}-${neighbour.id}`,
        path: getCurvedEdgePath(start, end, outgoingDirection, incomingDirection),
      });
    }
  }

  return edges;
}

function RobotMark({
  robots,
  nodeId,
  gridSize,
  selectedRobotId,
  onSelectRobot,
  onSelectNode,
  isMovingRobot,
}) {
  
  // Positions for placing more than one robot in the grid node
  const clusterPositions = [
    { x: -7, y: -3 }, { x: 0, y: -4 }, { x: 7, y: -3 },
    { x: -10, y: 4 }, { x: -3, y: 3 }, { x: 4, y: 3 }, { x: 10, y: 4 },
  ];
  
  if (robots.length === 0) return <circle className="fill-[var(--grid-empty)]" r="2.5" />;
  else if (robots.length === 1) {
    const robot = robots[0];
    const color = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length];
    const selectRobot = (event) => {
      event.stopPropagation();
      if (isMovingRobot) onSelectNode?.(nodeId);
      else onSelectRobot?.(robot.id);
    };

    return <g
      className="cursor-pointer outline-none"
      role="button"
      tabIndex="0"
      aria-label={isMovingRobot
        ? `Move Robot ${robot.id} to ${coordinateFor(nodeId, gridSize)}`
        : `Select robot ${robot.id}`}
      aria-pressed={selectedRobotId === robot.id}
      onClick={selectRobot}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRobot(event);
        }
      }}
    >
      <circle className={`${ROBOT_DOT_CLASSES[color]} stroke-white transition-all ${selectedRobotId === robot.id ? "stroke-[var(--grid-strong)] stroke-[2.5]" : "stroke-2"}`} r="10" />
      <text className="pointer-events-none fill-white text-[7px] font-bold" textAnchor="middle" dominantBaseline="central">{robot.id}</text>
      <title>{`Robot ${robot.id}`}</title>
    </g>;
  }

  const robotIds = robots.map((robot) => robot.id);
  const minRobotId = Math.min(...robotIds);
  const maxRobotId = Math.max(...robotIds);
  const rangeLabel = `min ${minRobotId} · max ${maxRobotId}`;
  const rangeWidth = Math.max(30, rangeLabel.length * 3.3 + 3);

  return <g>
    {robots.slice(0, clusterPositions.length).map((robot, index) => {
      const position = clusterPositions[index];
      const color = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length];
      return <circle
        key={robot.id}
        className={`${ROBOT_DOT_CLASSES[color]} cursor-pointer stroke-white transition-all ${selectedRobotId === robot.id ? "stroke-[var(--grid-strong)] stroke-[2]" : "stroke-1.5"}`}
        cx={position.x}
        cy={position.y}
        r={selectedRobotId === robot.id ? "4.5" : "3.8"}
        role="button"
        tabIndex="0"
        aria-label={isMovingRobot
          ? `Move Robot ${robot.id} to ${coordinateFor(nodeId, gridSize)}`
          : `Select robot ${robot.id}`}
        aria-pressed={selectedRobotId === robot.id}
        onClick={(event) => {
          event.stopPropagation();
          if (isMovingRobot) onSelectNode?.(nodeId);
          else onSelectRobot?.(robot.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            if (isMovingRobot) onSelectNode?.(nodeId);
            else onSelectRobot?.(robot.id);
          }
        }}
      ><title>{`Robot ${robot.id}`}</title></circle>;
    })}
    <rect className="fill-white stroke-[var(--grid-node-stroke)]" x={-rangeWidth / 2} y="-19" width={rangeWidth} height="10" rx="5" />
    <text className="pointer-events-none fill-[var(--grid-strong)] text-[5px] font-bold" x="0" y="-14" textAnchor="middle" dominantBaseline="central">{rangeLabel}</text>
    <text className="pointer-events-none fill-[var(--grid-strong)] stroke-white text-[8px] font-bold [paint-order:stroke] [stroke-width:2.5px]" x="0" y="14" textAnchor="middle" dominantBaseline="central">×{robots.length}</text>
  </g>;
}

function PortBump({ port, dx, dy }) {
  const path = dx === 1
    ? `M ${NODE_RADIUS} -${PORT_RADIUS} Q ${NODE_RADIUS + PORT_RADIUS * 2} 0 ${NODE_RADIUS} ${PORT_RADIUS} Z`
    : dx === -1
      ? `M -${NODE_RADIUS} ${PORT_RADIUS} Q -${NODE_RADIUS + PORT_RADIUS * 2} 0 -${NODE_RADIUS} -${PORT_RADIUS} Z`
      : dy === 1
        ? `M ${PORT_RADIUS} ${NODE_RADIUS} Q 0 ${NODE_RADIUS + PORT_RADIUS * 2} -${PORT_RADIUS} ${NODE_RADIUS} Z`
        : `M -${PORT_RADIUS} -${NODE_RADIUS} Q 0 -${NODE_RADIUS + PORT_RADIUS * 2} ${PORT_RADIUS} -${NODE_RADIUS} Z`;
  // The visual center of a semicircle sits closer to its flat edge than its
  // bounding-box center. Keeping the label there gives it more room.
  const labelOffset = NODE_RADIUS + PORT_RADIUS * 0.46;
  const x = dx * labelOffset;
  const y = dy * labelOffset;

  return <g>
    <path className="fill-[var(--grid-port)] stroke-[var(--grid-node-stroke)] stroke-[1.25] group-hover:fill-[var(--grid-port-hover)]" d={path} />
    <text className="pointer-events-none fill-[var(--grid-strong)] text-[6px] font-bold" x={x} y={y} textAnchor="middle" dominantBaseline="central">{port}</text>
  </g>;
}

export function GridNetworkSvg({
  nodes,
  gridSize,
  selectedNodeId,
  selectedRobotId,
  onSelectRobot,
  isMovingRobot,
  onSelectNode,
  viewportReserve = 16,
  isFullscreen = false,
  renderOverlay = null,
}) {
  const dimension = PADDING * 2 + (gridSize - 1) * PITCH;
  const preferredWidth = dimension * 1.6;
  const availableViewport = `max(18rem, calc(100dvh - ${viewportReserve}rem))`;
  const edges = getEdges(nodes, gridSize);

  return (
    <div className={`overflow-auto ${isFullscreen ? "p-0" : "p-1"}`}>
      <svg
        className="mx-auto block h-auto w-full select-none"
        style={{
          width: isFullscreen
            ? `min(100%, ${availableViewport})`
            : `min(100%, ${preferredWidth}px, ${availableViewport})`,
          height: isFullscreen ? availableViewport : undefined,
          maxHeight: `min(90vh, ${availableViewport})`,
          maxWidth: `min(90vh, ${availableViewport})`,
        }}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="group"
        aria-label={`${gridSize} by ${gridSize} robot grid`}
      >
        <g className="fill-[var(--grid-label)] text-[8px] font-semibold tracking-wide" aria-hidden="true">
          {Array.from({ length: gridSize }, (_, column) => <text key={`column-${column}`} x={PADDING + column * PITCH} y="13" textAnchor="middle">{String.fromCharCode(65 + column)}</text>)}
          {Array.from({ length: gridSize }, (_, row) => <text key={`row-${row}`} x="13" y={PADDING + row * PITCH} textAnchor="middle" dominantBaseline="central">{String(row + 1).padStart(2, "0")}</text>)}
        </g>

        <g aria-hidden="true">
          {edges.map((edge) => <path key={edge.key} d={edge.path} fill="none" className="stroke-[var(--grid-edge)] stroke-2 [stroke-linecap:round]" />)}
        </g>

        {nodes.map((node) => {
          const row = Math.floor(node.id / gridSize);
          const column = node.id % gridSize;
          const type = getNodeType(row, column, gridSize);
          const { x, y } = positionFor(node, gridSize);
          const selected = node.id === selectedNodeId;
          const nodeFill = type === "corner" ? "fill-[var(--grid-node-corner)]" : type === "boundary" ? "fill-[var(--grid-node-boundary)]" : "fill-[var(--surface)]";

          return <g
            key={node.id}
            className="group outline-none"
            transform={`translate(${x} ${y})`}
            role="group"
            aria-label={`Node ${coordinateFor(node.id, gridSize)}, degree ${node.getDegree()}, ${node.robots.length} robots`}
          >
            <circle
              className={`cursor-pointer stroke-[var(--grid-node-stroke)] transition-colors group-hover:fill-[var(--grid-node-hover)] group-hover:stroke-[var(--foreground)] focus-visible:stroke-[var(--foreground)] ${nodeFill} ${selected ? "fill-[var(--grid-node-hover)] stroke-[var(--foreground)] stroke-[3]" : "stroke-[1.5]"}`}
              r={NODE_RADIUS}
              role="button"
              tabIndex="0"
              aria-label={`Select node ${coordinateFor(node.id, gridSize)}`}
              aria-pressed={selected}
              onClick={() => onSelectNode(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectNode(node.id);
                }
              }}
            />
            {node.getNeighbours().map(([port]) => {
              const { dx, dy } = directionForPort(port);
              return <PortBump key={port} port={port} dx={dx} dy={dy} />;
            })}
            <RobotMark
              robots={node.robots}
              nodeId={node.id}
              gridSize={gridSize}
              selectedRobotId={selectedRobotId}
              onSelectRobot={onSelectRobot}
              onSelectNode={onSelectNode}
              isMovingRobot={isMovingRobot}
            />
            <title>{`Node ${coordinateFor(node.id, gridSize)}; ports: ${node.getNeighbours().map(([port]) => port).join(", ") || "none"}; robots: ${node.robots.map((robot) => robot.id).join(", ") || "none"}`}</title>
          </g>;
        })}
        {typeof renderOverlay === "function" ? renderOverlay({ nodes, gridSize, positionFor }) : renderOverlay}
      </svg>
    </div>
  );
}
