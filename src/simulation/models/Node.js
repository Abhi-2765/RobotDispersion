export class Node {
  constructor(id) {
    // Robots will never access this.
    this.id = id;

    // Map: port number -> neighbouring node
    this.ports = new Map();

    // Robots currently in this node
    this.robots = [];
  }

  addPort(portNumber, neighbour) {
    this.ports.set(portNumber, neighbour);
  }

  getDegree() {
    return this.ports.size;
  }

  getNeighbours() {
    return [...this.ports.entries()];
  }

  addRobot(robot) {
    this.robots.push(robot);
  }

  removeRobot(robotId) {
    this.robots = this.robots.filter(
      (robot) => robot.id !== robotId
    );
  }
}
