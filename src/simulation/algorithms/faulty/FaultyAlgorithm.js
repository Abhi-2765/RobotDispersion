import { AlgorithmInterface } from "../AlgorithmInterface.js";
import { FaultyStage1 } from "./FaultyStage1.js";
import { FaultyStage2 } from "./FaultyStage2.js";
import { FaultyStage3 } from "./FaultyStage3.js";
import {
  getFaultyStageProgress,
  isFaultyStage1Complete,
  isFaultyStage2Complete,
  isFaultyStage3Complete,
} from "./FaultyStageCompletion.js";

/**
 * Three-stage fault-tolerant dispersion algorithm for unoriented square grids.
 * Based on Banerjee, Kumar, and Molla (Section 4).
 *
 * Guaranteed round complexity: O(√n log n)
 * Robot memory: O(√n log n) bits
 * Resilient against up to f ≤ k crash faults.
 */
export class FaultyAlgorithm extends AlgorithmInterface {
  constructor({ n }) {
    super();

    if (!Number.isInteger(n) || n < 4) {
      throw new Error("n must be an integer greater than or equal to 4.");
    }

    const size = Math.sqrt(n);
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("The algorithm requires a square grid.");
    }

    this.n = n;
    this.size = size;

    // Theoretical round bounds from Lemma 5 and Lemma 6:
    // Stage 1 takes at most 56 log n + 59√n rounds
    this.stage1End = Math.ceil(56 * Math.log2(n) + 59 * size);
    // Stage 2 takes at most 12√n log n + 6√n rounds after Stage 1
    this.stage2End = this.stage1End + Math.ceil(12 * size * Math.log2(n) + 6 * size);

    this.currentStage = 1;

    this.stage1 = new FaultyStage1({ size });
    this.stage2 = new FaultyStage2({ size });
    this.stage3 = new FaultyStage3({ size });
  }

  getStage() {
    return this.currentStage;
  }

  getStageBounds() {
    return {
      stage1End: this.stage1End,
      stage2End: this.stage2End,
    };
  }

  getStageBoundary() {
    // Return null so the simulator immediately transitions to the next stage
    // as soon as the current stage completes, avoiding hundreds of idle round jumps.
    return null;
  }

  getStageProgress(simulation) {
    return getFaultyStageProgress(simulation, this.currentStage);
  }

  isStageComplete(simulation, stage = this.currentStage) {
    if (stage === 1) return isFaultyStage1Complete(simulation);
    if (stage === 2) return isFaultyStage2Complete(simulation);
    if (stage === 3) {
      return this.currentStage === 3 && isFaultyStage3Complete(simulation);
    }
    return false;
  }

  advanceStage() {
    if (this.currentStage < 3) this.currentStage += 1;
    return this.currentStage;
  }

  setStage(stage) {
    if (Number.isInteger(stage) && stage >= 1 && stage <= 3) {
      this.currentStage = stage;
    }
  }

  createMessage(observation, round) {
    const stage = this.getStage(round);
    if (stage === 1) return this.stage1.createMessage(observation, round);
    if (stage === 2) return this.stage2.createMessage(observation, round);
    return this.stage3.createMessage(observation, round);
  }

  compute(observation, inbox, round) {
    const stage = this.getStage(round);
    if (stage === 1) return this.stage1.compute(observation, inbox, round);
    if (stage === 2) return this.stage2.compute(observation, inbox, round);
    return this.stage3.compute(observation, inbox, round);
  }
}
