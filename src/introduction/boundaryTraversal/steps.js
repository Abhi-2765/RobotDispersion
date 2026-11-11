/**
 * Steps in the boundary-node-to-corner traversal procedure (paper Section 3.1 & 4.1).
 * Clickable in the educational walkthrough to jump directly to key stages.
 */
export const BOUNDARY_STEPS = [
  {
    id: 1,
    title: "1. Start at boundary node",
    description: "Robot is placed at a degree-3 boundary node with no global orientation.",
  },
  {
    id: 2,
    title: "2. Evaluate port candidates",
    description: "Exclude incoming and previous boundary ports, then select minimum port.",
  },
  {
    id: 3,
    title: "3. Probe internal node",
    description: "Entered an internal node (degree 4); detect non-boundary destination.",
  },
  {
    id: 4,
    title: "4. Backtrack across edge",
    description: "Return immediately to previous boundary node using reciprocal incoming port.",
  },
  {
    id: 5,
    title: "5. Advance along boundary",
    description: "Follow the valid perimeter edge to the next boundary node.",
  },
  {
    id: 6,
    title: "6. Reach grid corner",
    description: "Encounter a degree-2 corner node and settle permanently.",
  },
  {
    id: 7,
    title: "7. Crash termination",
    description: "Robot crashes and permanently ceases operation (faulty mode only).",
  },
];
