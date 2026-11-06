import { coordinateFor } from "./gridPresentation.js";

export function NodeInspector({ node, gridSize }) {
  if (!node) {
    return <aside className="border border-border bg-surface p-4">
      <h3 className="text-base font-bold">Node details</h3>
      <p className="mt-2 text-sm text-foreground-muted">Select a node to inspect it.</p>
    </aside>;
  }

  const type = node.getDegree() === 2 ? "Corner" : node.getDegree() === 3 ? "Boundary" : "Internal";

  return (
    <aside className="h-fit border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Node {coordinateFor(node.id, gridSize)}</h3>
          <p className="mt-1 text-xs text-foreground-muted">{type} · degree {node.getDegree()}</p>
        </div>
        <span className="bg-surface-muted px-2 py-1 text-xs font-semibold tabular-nums">{node.robots.length} {node.robots.length === 1 ? "robot" : "robots"}</span>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-medium text-foreground-muted">Robots</h4>
        {node.robots.length ? <div className="mt-2 flex flex-wrap gap-1.5">
          {node.robots.map((robot) => <span key={robot.id} className="border border-border px-2 py-1 text-xs tabular-nums">{robot.id}</span>)}
        </div> : <p className="mt-2 text-sm text-foreground-muted">None</p>}
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-medium text-foreground-muted">Local ports</h4>
        <ul className="mt-2 space-y-2">
          {node.getNeighbours().map(([port, neighbour]) => <li key={port} className="flex items-center justify-between text-xs">
            <span className="bg-surface-muted px-1.5 py-1 tabular-nums">Port {port}</span>
            <span className="text-foreground-muted">→ {coordinateFor(neighbour.id, gridSize)}</span>
          </li>)}
        </ul>
      </div>

      <p className="mt-5 border-t border-border pt-3 text-xs leading-relaxed text-foreground-muted">Coordinates are shown for the viewer; robots only observe local ports and node degree.</p>
    </aside>
  );
}
