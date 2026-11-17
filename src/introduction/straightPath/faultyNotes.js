import { PAPER_STATED_ROUNDS } from "./probeSearch.js";

/**
 * What the paper (Section 4, "Straight Line Movement for the internal Faulty
 * Robots") states explicitly. Paraphrased, not quoted.
 */
export const PAPER_STATEMENTS = {
  P1: "Only half of the robots search for the direction: the ⌊t/2⌋ highest-ID robots explore, and the other half stay where they are, waiting for the port number.",
  P2: "All robots first move through port 1 for one round and must then avoid the backward port. The explorers take the next lowest port and explore up to four port distances from the group, 3 × 3 × 3 = 27 nodes, giving priority to the lowest port.",
  P3: "A single reporting explorer is enough to learn the port. The two ports through which the explorers reach the group's node are 180° apart, and the same two cases as in Section 3 decide the straight port.",
  P4: "If the explorers all crash, or the waiting half crashes, the remaining robots split into two groups and repeat. This can happen at most log n times.",
  P5: "All robots that have not crashed then move through the straight port, and the process repeats at each node until the boundary.",
};

/**
 * What the paper leaves open, and what this demo assumes instead. These are
 * not claims about the paper.
 */
export const DEMO_ASSUMPTIONS = {
  A1: "All explorers follow the same deterministic port-order walk together, so one survivor can report on its own. The paper says one reporting robot suffices but not whether explorers split the tree or duplicate the work.",
  A2: `Waiting robots decide the explorers have failed after a timeout. In this educational visual demonstration, the timeout follows the 80 rounds of a complete physical DFS walk (2 × 39 + 2), which is longer than the paper's theoretical proof accounting bound of ${PAPER_STATED_ROUNDS} rounds (2 × 27 + 2).`,
  A3: "After a failed attempt the robots still at the node split again: the ⌊t′/2⌋ highest IDs explore and the rest wait. The paper says only that the remaining robots partition themselves into two groups.",
  A4: "The reference badge ('R') is assigned to the minimum-ID robot purely as a tutorial visual anchor. The paper requires only that waiting robots remain at the node; designating a specific robot as the anchor is a visual convention, not a paper-guaranteed rule.",
  A5: "Crashes are triggered manually by the user or following educational scenarios. The paper does not specify when crashes occur.",
  A6: "Crashed robots are invisible to the others in the model. The ✕ marker is drawn only to explain the scenario, and the long wait is collapsed into one frame.",
  A7: "A crash of the waiting half is not shown. The paper does not say how explorers recognise the reference node when no robot is left there.",
};

export const FAULTY_SCENARIO_INFO = {
  none: {
    label: "No crashes",
    description: "The fault-tolerant procedure runs with every robot surviving.",
    minRobots: 2,
  },
  partial: {
    label: "Some explorers crash",
    description: "All explorers except the lowest-ID explorer crash after the 6th probe round; the survivor still reports.",
    minRobots: 4,
  },
  allExplorers: {
    label: "All explorers crash",
    description: "Every explorer crashes after the 6th probe round; the waiters time out, re-split and repeat.",
    minRobots: 3,
  },
};
