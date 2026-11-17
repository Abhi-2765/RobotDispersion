import {
  NODE_RADIUS,
  PORT_OFFSET,
  PORT_RADIUS,
  positionFor,
  directionForPort,
  getCurvedEdgePath,
} from "../simulator/gridGeometry.js";

const MARKER_COLORS = {
  backward: "#5b7885",
  return: "#b58a4b",
  straight: "#657b60",
};
const MARKER_LABELS = {
  backward: "backward port",
  return: "return port",
  straight: "straight port",
};
const ROLE_BADGES = {
  explorer: { letter: "E", fill: "#b66f50", dx: 15, dy: -15 },
  reference: { letter: "R", fill: "#806579", dx: -15, dy: -15 },
  waiting: { letter: "W", fill: "#81804f", dx: -15, dy: 15 },
};

function centre(nodeId, size) {
  return positionFor({ id: nodeId }, size);
}

/**
 * Builds curved cubic Bézier paths along the grid's wires for consecutive nodes,
 * matching GridNetworkSvg's curved edge geometry and port socket directions.
 */
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
      key: `${index}-${fromId}-${toId}`,
      d: getCurvedEdgePath(startPos, endPos, outDir, inDir),
    });
  }
  return paths;
}

/**
 * SVG drawn inside GridNetworkSvg's coordinate system via renderOverlay.
 * Derived from the animation frame without mutating simulation engine state.
 */
export function StraightPathOverlay({ view, frame, staticRobotNodeIds }) {
  const size = view.size;
  const occupiedByGroup = new Set(Object.values(frame.positions));
  const veiled = [...staticRobotNodeIds].filter((nodeId) => !occupiedByGroup.has(nodeId));

  const badges = new Map();
  for (const [robotId, nodeId] of Object.entries(frame.positions)) {
    const role = frame.roles[robotId];
    if (!ROLE_BADGES[role]) continue;
    if (!badges.has(nodeId)) badges.set(nodeId, new Set());
    badges.get(nodeId).add(role);
  }

  const crashedByNode = new Map();
  for (const item of frame.crashed) {
    crashedByNode.set(item.nodeId, [...(crashedByNode.get(item.nodeId) ?? []), item.robotId]);
  }

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {veiled.map((nodeId) => {
        const { x, y } = centre(nodeId, size);
        return <circle key={`veil-${nodeId}`} cx={x} cy={y} r={PORT_OFFSET - PORT_RADIUS - 1} fill="#faf6ef" opacity="0.62" />;
      })}

      {polylineEdges(frame.trail, size, view).map(({ key, d }) => (
        <path key={`trail-${key}`} d={d} fill="none" stroke="#657b60" strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" opacity="0.8" />
      ))}

      {polylineEdges(frame.probePath, size, view).map(({ key, d }) => (
        <path key={`probe-${key}`} d={d} fill="none" stroke="#b66f50" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
      ))}

      {frame.focusNodeId !== null && (() => {
        const { x, y } = centre(frame.focusNodeId, size);
        return <circle cx={x} cy={y} r={NODE_RADIUS + 5} fill="none" stroke="#806579" strokeWidth="2" strokeDasharray="4 3" />;
      })()}

      {frame.explorerNodeId !== null && frame.explorerNodeId !== frame.focusNodeId && (() => {
        const { x, y } = centre(frame.explorerNodeId, size);
        return <circle cx={x} cy={y} r={NODE_RADIUS + 4} fill="none" stroke="#b66f50" strokeWidth="2.5" />;
      })()}

      {frame.markers.map((marker) => {
        const { x, y } = centre(marker.nodeId, size);
        const { dx, dy } = directionForPort(marker.port);
        return (
          <circle
            key={`${marker.kind}-${marker.nodeId}-${marker.port}`}
            cx={x + dx * PORT_OFFSET}
            cy={y + dy * PORT_OFFSET}
            r={PORT_RADIUS + 3.5}
            fill="none"
            stroke={MARKER_COLORS[marker.kind]}
            strokeWidth="2.5"
          >
            <title>{`${MARKER_LABELS[marker.kind]} ${marker.port}`}</title>
          </circle>
        );
      })}

      {[...badges.entries()].flatMap(([nodeId, roles]) => {
        const { x, y } = centre(nodeId, size);
        return [...roles].map((role) => {
          const badge = ROLE_BADGES[role];
          return (
            <g key={`badge-${nodeId}-${role}`} transform={`translate(${x + badge.dx} ${y + badge.dy})`}>
              <circle r="6.5" fill={badge.fill} stroke="#faf6ef" strokeWidth="1.5" />
              <text className="fill-[#faf6ef] text-[7.5px] font-bold" textAnchor="middle" dominantBaseline="central">{badge.letter}</text>
            </g>
          );
        });
      })}

      {[...crashedByNode.entries()].map(([nodeId, ids]) => {
        const { x, y } = centre(nodeId, size);
        return (
          <g key={`crash-${nodeId}`} transform={`translate(${x + 15} ${y + 15})`}>
            <circle r="6.5" fill="#a65345" stroke="#faf6ef" strokeWidth="1.5" />
            <text className="fill-[#faf6ef] text-[8px] font-bold" textAnchor="middle" dominantBaseline="central">{ids.length > 1 ? ids.length : "✕"}</text>
          </g>
        );
      })}
    </g>
  );
}
