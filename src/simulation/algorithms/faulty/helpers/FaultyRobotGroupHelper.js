/**
 * Helper utilities for faulty robot group partitioning and identification.
 * In the faulty model, groups of t robots partition into:
 * - ⌊t/2⌋ highest-ID robots (scouts/seekers)
 * - ⌈t/2⌉ lowest-ID robots (waiting base/non-seekers)
 */
export class FaultyRobotGroupHelper {
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

  /**
   * Partitions an array of robot IDs into waiting base and scout/seeker groups.
   * Scouts get ⌊t/2⌋ highest IDs; waiting base gets ⌈t/2⌉ lowest IDs.
   */
  static splitGroup(robotIds) {
    const sorted = [...new Set(robotIds)].sort((a, b) => a - b);
    const t = sorted.length;
    if (t <= 1) {
      return {
        waitingIds: sorted,
        scoutIds: [],
        scoutCount: 0,
        waitingCount: t,
      };
    }

    const scoutCount = Math.floor(t / 2);
    const waitingCount = t - scoutCount;
    const waitingIds = sorted.slice(0, waitingCount);
    const scoutIds = sorted.slice(waitingCount);

    return {
      waitingIds,
      scoutIds,
      waitingCount,
      scoutCount,
    };
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
}
