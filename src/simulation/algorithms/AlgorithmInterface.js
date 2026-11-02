export class AlgorithmInterface {
  createMessage(observation, round) {
    throw new Error("createMessage() must be implemented.");
  }

  compute(observation, inbox, round) {
    throw new Error("compute() must be implemented.");
  }
}
