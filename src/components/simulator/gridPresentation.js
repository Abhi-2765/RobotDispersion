/** Display-only helpers. Their coordinates never enter robot observations. */
export function coordinateFor(nodeId, size) {
  const row = Math.floor(nodeId / size);
  const column = nodeId % size;
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

export function getNodeType(row, column, size) {
  const onHorizontalEdge = row === 0 || row === size - 1;
  const onVerticalEdge = column === 0 || column === size - 1;
  if (onHorizontalEdge && onVerticalEdge) return "corner";
  if (onHorizontalEdge || onVerticalEdge) return "boundary";
  return "internal";
}
