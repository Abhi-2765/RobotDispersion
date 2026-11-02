
export class CommunicationManager {
  exchange(robots, observations, algorithm, round) {

    if (typeof algorithm?.createMessage !== "function") {
      throw new Error("Algorithm must implement createMessage().");
    }

    // one inbox for every robot alive
    const inboxes = {};

    // robots groupped by nodes they are present in
    const groups = new Map();

    // add robot to groups[currnetNode]
    for (const robot of robots) {
      if (!robot.alive) continue;

      inboxes[robot.id] = [];

      const node = robot.currentNode;

      if (!groups.has(node)) {
        groups.set(node, []);
      }

      groups.get(node).push(robot);
    }

    // only robots in a group i.e., colocated robots can communicate with each other
    for (const group of groups.values()) {
      if (group.length < 2) continue;

      const outgoingMessages = [];

      for (const sender of group) {
        const observation = observations[sender.id];

        const payload = algorithm.createMessage(
          observation,
          round
        );

        if (payload === null || payload === undefined) continue;

        outgoingMessages.push({
          senderId: sender.id,
          payload: structuredClone(payload),
        });
      }

      for (const recipient of group) {
        for (const message of outgoingMessages) {
          if (message.senderId === recipient.id) continue;

          inboxes[recipient.id].push({
            fromRobotId: message.senderId,
            payload: structuredClone(message.payload),
          });
        }
      }
    }

    return inboxes;
  }
}
