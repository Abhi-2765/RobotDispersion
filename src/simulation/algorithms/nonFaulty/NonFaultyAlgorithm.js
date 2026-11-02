import { AlgorithmInterface } from "../AlgorithmInterface.js";
import { Stage1 } from "./Stage1.js";
import { Stage2 } from "./Stage2.js";
import { Stage3 } from "./Stage3.js";

/**
 * Three-stage non-faulty dispersion algorithm.
 *
 * Stage boundaries follow the paper's round schedule:
 *   Stage 1: 59*sqrt(n) rounds
 *   Stage 2: 18*sqrt(n) additional rounds (through 77*sqrt(n))
 *   Stage 3: thereafter
 *
 * Stage 3 currently uses the documented marker-assisted DFS completion
 * procedure rather than the paper's underspecified paired-column routine.
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

    this.stage1 = new Stage1({ size });
    this.stage2 = new Stage2({ size });
    this.stage3 = new Stage3({ size });
  }

  getStage(round = 0) {
    if (round <= this.stage1End) return 1;
    if (round <= this.stage2End) return 2;
    return 3;
  }

  getStageBounds() {
    return {
      stage1End: this.stage1End,
      stage2End: this.stage2End,
    };
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
