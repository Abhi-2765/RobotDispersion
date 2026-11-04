import { coordinateFor, getNodeType } from "./gridPresentation.js";

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
const PITCH = 68;
const PADDING = 42;
const NODE_RADIUS = 20;
const PORT_OFFSET = 18;
const PORT_RADIUS = 7;

function positionFor(node, size) {
  return {
    x: PADDING + (node.id % size) * PITCH,
    y: PADDING + Math.floor(node.id / size) * PITCH,
  };
}

function directionBetween(from, to, size) {
  const fromRow = Math.floor(from.id / size);
  const fromColumn = from.id % size;
  const toRow = Math.floor(to.id / size);
  const toColumn = to.id % size;
  return { dx: Math.sign(toColumn - fromColumn), dy: Math.sign(toRow - fromRow) };
}

function getEdges(nodes, size) {
  const edges = [];

  for (const node of nodes) {
    for (const [, neighbour] of node.getNeighbours()) {
      if (node.id > neighbour.id) continue;
      const start = positionFor(node, size);
      const end = positionFor(neighbour, size);
      const { dx, dy } = directionBetween(node, neighbour, size);
      edges.push({
        key: `${node.id}-${neighbour.id}`,
        x1: start.x + dx * PORT_OFFSET,
        y1: start.y + dy * PORT_OFFSET,
        x2: end.x - dx * PORT_OFFSET,
        y2: end.y - dy * PORT_OFFSET,
      });
    }
  }

  return edges;
}

function RobotMark({ robots }) {
  
  // Positions for placing more than one robot in the grid node
  const clusterPositions = [
    { x: -7, y: -8 }, { x: 0, y: -10 }, { x: 7, y: -8 },
    { x: -10, y: -1 }, { x: -3, y: -2 }, { x: 4, y: -2 }, { x: 10, y: -1 },
    { x: -7, y: 6 }, { x: 0, y: 5 }, { x: 7, y: 6 },
  ];
  
  if (robots.length === 0) return <circle className="fill-[#c7b69f]" r="2.5" />;
  else if (robots.length === 1) {
    const robot = robots[0];
    const color = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length];
    return <circle className={`${ROBOT_DOT_CLASSES[color]} stroke-[#faf6ef] stroke-1`} r="5"><title>{`Robot ${robot.id}`}</title></circle>;
  }

  return <g>
    {robots.slice(0, clusterPositions.length).map((robot, index) => {
      const position = clusterPositions[index];
      const color = ROBOT_COLORS[(robot.id - 1) % ROBOT_COLORS.length];
      return <circle
        key={robot.id}
        className={`${ROBOT_DOT_CLASSES[color]} stroke-[#faf6ef] stroke-1`}
        cx={position.x}
        cy={position.y}
        r="3.2"
      ><title>{`Robot ${robot.id}`}</title></circle>;
    })}
    <text className="fill-[#49392d] stroke-[#faf6ef] text-[8px] font-bold [paint-order:stroke] [stroke-width:2.5px]" x="0" y="14" textAnchor="middle" dominantBaseline="central">×{robots.length}</text>
  </g>;
}

function PortBump({ port, dx, dy, showPorts }) {
  const x = dx * PORT_OFFSET;
  const y = dy * PORT_OFFSET;

  return <g>
    <circle className="fill-[#d5c4aa] stroke-[#faf6ef] stroke-[1.5] group-hover:fill-[#bd8c68]" cx={x} cy={y} r={PORT_RADIUS} />
    {showPorts && <text className="pointer-events-none fill-[#49392d] text-[8px] font-bold" x={x} y={y} textAnchor="middle" dominantBaseline="central">{port}</text>}
  </g>;
}

export function GridNetworkSvg({ nodes, gridSize, selectedNodeId, onSelectNode, showPorts }) {
  const dimension = PADDING * 2 + (gridSize - 1) * PITCH;
  const edges = getEdges(nodes, gridSize);

  return (
    <div className="overflow-auto px-2 py-3 sm:px-4">
      <svg
        className="mx-auto block h-auto w-full select-none"
        style={{
          maxHeight: "min(80vh, max(0px, calc(100dvh - 14rem)))",
          maxWidth: "min(80vh, max(0px, calc(100dvh - 14rem)))",
        }}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="group"
        aria-label={`${gridSize} by ${gridSize} robot grid`}
      >
        <g className="fill-[#9a8873] text-[8px] font-semibold tracking-wide" aria-hidden="true">
          {Array.from({ length: gridSize }, (_, column) => <text key={`column-${column}`} x={PADDING + column * PITCH} y="13" textAnchor="middle">{String.fromCharCode(65 + column)}</text>)}
          {Array.from({ length: gridSize }, (_, row) => <text key={`row-${row}`} x="13" y={PADDING + row * PITCH} textAnchor="middle" dominantBaseline="central">{String(row + 1).padStart(2, "0")}</text>)}
        </g>

        <g aria-hidden="true">
          {edges.map((edge) => <line key={edge.key} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} className="stroke-[#bdaa91] stroke-2 [stroke-linecap:round]" />)}
        </g>

        {nodes.map((node) => {
          const row = Math.floor(node.id / gridSize);
          const column = node.id % gridSize;
          const type = getNodeType(row, column, gridSize);
          const { x, y } = positionFor(node, gridSize);
          const selected = node.id === selectedNodeId;
          const nodeFill = type === "corner" ? "fill-[#efe3cb]" : type === "boundary" ? "fill-[#f6eee2]" : "fill-[#faf6ef]";

          return <g
            key={node.id}
            className="group cursor-pointer outline-none"
            transform={`translate(${x} ${y})`}
            role="button"
            tabIndex="0"
            aria-label={`Node ${coordinateFor(node.id, gridSize)}, degree ${node.getDegree()}, ${node.robots.length} robots`}
            aria-pressed={selected}
            onClick={() => onSelectNode(node.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectNode(node.id);
              }
            }}
          >
            <circle className={`stroke-[#a99477] transition-colors group-hover:fill-[#f0e2cf] group-hover:stroke-[#b66f50] group-focus-visible:stroke-[#8b5540] ${nodeFill} ${selected ? "fill-[#f0e2cf] stroke-[#b66f50] stroke-[3]" : "stroke-[1.5]"}`} r={NODE_RADIUS} />
            {node.getNeighbours().map(([port, neighbour]) => {
              const { dx, dy } = directionBetween(node, neighbour, gridSize);
              return <PortBump key={port} port={port} dx={dx} dy={dy} showPorts={showPorts} />;
            })}
            <RobotMark robots={node.robots} />
            <title>{`Node ${coordinateFor(node.id, gridSize)}; ports: ${node.getNeighbours().map(([port]) => port).join(", ") || "none"}; robots: ${node.robots.map((robot) => robot.id).join(", ") || "none"}`}</title>
          </g>;
        })}
      </svg>
    </div>
  );
}
