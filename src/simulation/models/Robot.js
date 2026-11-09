
export class Robot {
  constructor(id, startNode) {
    this.id = id;

    // Node ID for rendering the robot.
    // Won't be used in the algorithm
    this.currentNode = startNode;

    this.alive = true;
    this.role = null;

    // Robot's memory
    this.memory = {};

    // Robot's own movement history
    this.traversalHistory = [];
  }

  // Record a completed traversal
  recordTraversal(round, outgoingPort, incomingPort) {
    this.traversalHistory.push({
      round,
      outgoingPort,
      incomingPort,
    });
  }

  setCurrentNode(node) {
    this.currentNode = node;
  }

  // Store info in memory
  remember(key, value) {
    this.memory[key] = value;
  }

  // Retrieve info from memory
  recall(key) {
    return this.memory[key];
  }

  // Set Robot's role
  setRole(role) {
    this.role = role;
  }

  // Simulate Crash
  crash() {
    this.alive = false;
    if (this.currentNode) {
      this.currentNode.removeRobot(this.id);
    }
    this.currentNode = null;
    this.role = "crashed";
  }
}
