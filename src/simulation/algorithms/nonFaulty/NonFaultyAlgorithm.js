import { AlgorithmInterface } from "../AlgorithmInterface.js";
import { Stage1 } from "./Stage1.js";
import { Stage2 } from "./Stage2.js";
import { Stage3 } from "./Stage3.js";
import {
  getNonFaultyStageProgress,
  isStage1Complete,
  isStage2Complete,
  isStage3Complete,
} from "./StageCompletion.js";

/**
 * Three-stage non-faulty dispersion algorithm.
 *
 * Stage completion is outcome-driven. The paper's round schedule supplies
 * upper-bound targets for fast-forwarding when a stage finishes early.
 *
 * Stage 3 follows the paper's perimeter and paired-column dispersion cases.
 */
export class NonFaultyAlgorithm extends AlgorithmInterface {
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
    this.stage1End = 59 * size;
    this.stage2End = 77 * size;
    this.currentStage = 1;

    this.stage1 = new Stage1({ size });
    this.stage2 = new Stage2({ size });
    this.stage3 = new Stage3({ size });
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

  getStageBoundary(stage) {
    if (stage === 1) return this.stage1End;
    if (stage === 2) return this.stage2End;
    return null;
  }

  getStageProgress(simulation) {
    return getNonFaultyStageProgress(simulation, this.currentStage);
  }

  isStageComplete(simulation, stage = this.currentStage) {
    if (stage === 1) return isStage1Complete(simulation);
    if (stage === 2) return isStage2Complete(simulation);
    if (stage === 3) {
      return this.currentStage === 3 && isStage3Complete(simulation);
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
