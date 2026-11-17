import { buildBoundaryScript } from "./boundaryScript.js";

/**
 * Boundary traversal variants keyed by algorithmMode ("nonFaulty" vs "faulty").
 */
export const BOUNDARY_VARIANTS = {
  nonFaulty: {
    label: "Non-faulty",
    paperSection: "Section 3.1",
    buildScript: (view, robot, options) => buildBoundaryScript(view, robot, { ...options, scenario: "clean" }),
  },
  faulty: {
    label: "Faulty",
    paperSection: "Section 4.1",
    buildScript: (view, robot, options) => buildBoundaryScript(view, robot, options),
  },
};

export function tryBuildBoundaryScript(variant, view, robot, options) {
  try {
    return { script: variant.buildScript(view, robot, options) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not build boundary traversal demonstration." };
  }
}
