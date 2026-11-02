export class AlgorithmInterface {
  createMessage() {
    throw new Error("createMessage() must be implemented.");
  }

  compute() {
    throw new Error("compute() must be implemented.");
  }
}
