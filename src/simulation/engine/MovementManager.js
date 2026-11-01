
export class MovementManager {
  execute(movements, round) {
    for (const movement of movements) {
      const {
        robot,
        origin, // current position of robot
        destination,
        outgoingPort,
        incomingPort,
      } = movement;

      if (!robot.alive || robot.currentNode !== origin) {
        throw new Error(`Invalid movement for robot ${robot.id}.`);
      }

      if (origin.ports.get(outgoingPort) !== destination) {
        throw new Error(`Invalid outgoing port for robot ${robot.id}.`);
      }

      if (destination.ports.get(incomingPort) !== origin) {
        throw new Error(`Invalid incoming port for robot ${robot.id}.`);
      }
    }

    // Remove robot from its current loc.
    for (const movement of movements) {
      movement.origin.removeRobot(movement.robot.id);
    }

    // Move robot to its destination
    for (const movement of movements) {
      const {
        robot,
        destination,
        outgoingPort,
        incomingPort,
      } = movement;

      robot.setCurrentNode(destination);

      robot.remember("incomingPort", incomingPort);

      robot.recordTraversal(
        round,
        outgoingPort,
        incomingPort
      );

      destination.addRobot(robot);
    }

    return movements.length;
  }
}
