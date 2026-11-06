export class AlgorithmInterface {
  getStage() {
    return 1;
  }

  getStageCount() {
    return 3;
  }

  createMessage() {
    throw new Error("createMessage() must be implemented.");
  }

  compute() {
    throw new Error("compute() must be implemented.");
  }

  /** Return a global progress snapshot for the simulator UI. */
  getStageProgress() {
    return null;
  }

  /** Return whether the global end condition for this stage is satisfied. */
  isStageComplete() {
    return false;
  }

  /** Return the scheduled last round of a stage, used when fast-forwarding. */
  getStageBoundary() {
    return null;
  }

  advanceStage() {
    return this.getStage();
  }

  setStage() {}
}
