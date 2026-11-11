import { buildNonFaultyScript } from "./nonFaultyScript.js";
import { buildFaultyScript } from "./faultyScript.js";

/**
 * Straight-path discovery variants, keyed by the app's `algorithmMode`.
 * The two variants share UI but not algorithm logic.
 */
export const STRAIGHT_PATH_VARIANTS = {
  nonFaulty: {
    label: "Non-faulty",
    paperSection: "Section 3",
    buildScript: (view, groupNodeId, options) => buildNonFaultyScript(view, groupNodeId, options),
  },
  faulty: {
    label: "Faulty",
    paperSection: "Section 4",
    buildScript: (view, groupNodeId, options) => buildFaultyScript(view, groupNodeId, options),
  },
};

/**
 * Builds a variant's script without throwing, so the page can show an error
 * message instead of crashing. Kept outside the component on purpose.
 */
export function tryBuildScript(variant, view, groupNodeId, options) {
  try {
    return { script: variant.buildScript(view, groupNodeId, options) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The demonstration could not be built." };
  }
}
