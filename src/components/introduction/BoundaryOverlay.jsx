import {
  NODE_RADIUS,
  PORT_OFFSET,
  PORT_RADIUS,
  positionFor,
  directionForPort,
  getCurvedEdgePath,
} from "../simulator/gridGeometry.js";

function centre(nodeId, size) {
  return positionFor({ id: nodeId }, size);
}

function polylineEdges(nodeIds, size, view) {
  const paths = [];
  for (let index = 1; index < nodeIds.length; index += 1) {
    const fromId = nodeIds[index - 1];
    const toId = nodeIds[index];
    const outPort = view.neighbours(fromId).find(([, target]) => target === toId)?.[0];
    if (outPort === undefined) continue;
    const inPort = view.reciprocalPort(fromId, outPort);
    const startPos = centre(fromId, size);
    const endPos = centre(toId, size);
    const outDir = directionForPort(outPort);
    const inDir = directionForPort(inPort);
    paths.push({
      key: `trail-${index}-${fromId}-${toId}`,
      d: getCurvedEdgePath(startPos, endPos, outDir, inDir),
    });
  }
  return paths;
}

/**
 * Overlay rendered inside GridNetworkSvg for Boundary Traversal.
 * Shows node classifications (Corner, Boundary, Internal), active trail,
 * active probe/return edge, selected port highlight, and crash indicator.
 */
export function BoundaryOverlay({ view, frame, staticRobotNodeIds }) {
  const size = view.size;
  const veiled = [...staticRobotNodeIds].filter((nodeId) => nodeId !== frame.currentNodeId);

  // Active edge path (probe, backtrack, or boundary advance)
  let activeEdgePath = null;
  if (frame.activeEdge) {
    const { fromNodeId, toNodeId, fromPort, toPort, kind } = frame.activeEdge;
    const startPos = centre(fromNodeId, size);
    const endPos = centre(toNodeId, size);
    const outDir = directionForPort(fromPort);
    const inDir = directionForPort(toPort);
    activeEdgePath = {
      d: getCurvedEdgePath(startPos, endPos, outDir, inDir),
      kind,
    };
  }

  // Position of current active robot
  const robotPos = frame.currentNodeId !== null ? centre(frame.currentNodeId, size) : null;

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {/* Node classification accents */}
      {view.nodeIds.map((nodeId) => {
        const deg = view.degree(nodeId);
        const { x, y } = centre(nodeId, size);
        if (deg === 2) {
          // Corner node (amber accent)
          return (
            <circle
              key={`corner-accent-${nodeId}`}
              cx={x}
              cy={y}
              r={NODE_RADIUS + 7}
              fill="none"
              stroke="#b58a4b"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          );
        }
        if (deg === 3) {
          // Boundary node (teal/blue accent)
          return (
            <circle
              key={`boundary-accent-${nodeId}`}
              cx={x}
              cy={y}
              r={NODE_RADIUS + 5}
              fill="none"
              stroke="#5b7885"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.6"
            />
          );
        }
        return null;
      })}

      {/* Dimmed circles over static robots */}
      {veiled.map((nodeId) => {
        const { x, y } = centre(nodeId, size);
        return (
          <circle
            key={`veil-${nodeId}`}
            cx={x}
            cy={y}
            r={PORT_OFFSET - PORT_RADIUS - 1}
            fill="#faf6ef"
            opacity="0.62"
          />
        );
      })}

      {/* Traversed perimeter trail */}
      {polylineEdges(frame.trail, size, view).map(({ key, d }) => (
        <path
          key={key}
          d={d}
          fill="none"
          stroke="#657b60"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="4 4"
          opacity="0.85"
        />
      ))}

      {/* Active edge highlight */}
      {activeEdgePath && (
        <path
          d={activeEdgePath.d}
          fill="none"
          stroke={
            activeEdgePath.kind === "probe"
              ? "#b66f50" // Amber/brown for internal probe
              : activeEdgePath.kind === "return"
                ? "#806579" // Purple for backtrack return
                : "#44784a" // Solid green for boundary advance
          }
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.95"
        />
      )}

      {/* Active robot highlight ring */}
      {robotPos && !frame.isCrashed && (
        <g>
          <circle
            cx={robotPos.x}
            cy={robotPos.y}
            r={NODE_RADIUS + 9}
            fill="none"
            stroke="#b66f50"
            strokeWidth="2.5"
          />
          <circle
            cx={robotPos.x}
            cy={robotPos.y}
            r={NODE_RADIUS + 13}
            fill="none"
            stroke="#b66f50"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.7"
          />
        </g>
      )}

      {/* Crash indicator */}
      {frame.isCrashed && robotPos && (
        <g>
          <circle
            cx={robotPos.x}
            cy={robotPos.y}
            r={NODE_RADIUS + 8}
            fill="#e5484d"
            opacity="0.25"
          />
          <circle
            cx={robotPos.x}
            cy={robotPos.y}
            r={NODE_RADIUS + 6}
            fill="none"
            stroke="#e5484d"
            strokeWidth="2.5"
          />
          <text
            x={robotPos.x}
            y={robotPos.y - NODE_RADIUS - 10}
            textAnchor="middle"
            fill="#e5484d"
            fontSize="12"
            fontWeight="bold"
          >
            CRASHED
          </text>
        </g>
      )}
    </g>
  );
}
