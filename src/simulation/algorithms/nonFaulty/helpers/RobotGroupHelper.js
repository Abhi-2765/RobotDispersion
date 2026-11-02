export class RobotGroupHelper {
  static getMinimumId(robotIds) {
    if (!Array.isArray(robotIds) || robotIds.length === 0) {
      return null;
    }

    return Math.min(...robotIds);
  }

  static getMaximumId(robotIds) {
    if (!Array.isArray(robotIds) || robotIds.length === 0) {
      return null;
    }

    return Math.max(...robotIds);
  }

  static isSingleton(observation) {
    return observation.coLocatedRobotIds.length === 1;
  }

  static isGroup(observation) {
    return observation.coLocatedRobotIds.length > 1;
  }

  static isCorner(observation) {
    return observation.degree === 2;
  }

  static isBoundary(observation) {
    return observation.degree === 3;
  }

  static isInternal(observation) {
    return observation.degree === 4;
  }

  static isMinimumIdRobot(observation) {
    return (
      observation.robotId ===
      this.getMinimumId(observation.coLocatedRobotIds)
    );
  }

  static isMaximumIdRobot(observation) {
    return (
      observation.robotId ===
      this.getMaximumId(observation.coLocatedRobotIds)
    );
  }

  static getOtherRobotIds(observation) {
    return observation.coLocatedRobotIds.filter(
      (id) => id !== observation.robotId
    );
  }
}