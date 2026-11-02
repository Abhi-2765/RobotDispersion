
import { Node } from "./Node.js";

export class Grid {
  constructor(size, random = Math.random) {
    if (!Number.isInteger(size) || size < 2) {
      throw new Error("Grid size must be an integer greater than or equal to 2.");
    }

    if (typeof random !== "function") {
      throw new Error("Random source must be a function.");
    }

    this.size = size;
    this.nodes = new Map();

    this.createNodes();
    this.connectNodes(random);
  }

  createNodes() {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        // internal ID of node from row and col numbers.
        const id = row * this.size + col;
        this.nodes.set(id, new Node(id));
      }
    }
  }

  // Connect neighbouring nodes and assign local ports
  connectNodes(random) {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const node = this.getNodeAt(row, col);

        const neighbours = [];

        if (row > 0) {
          neighbours.push(this.getNodeAt(row - 1, col));
        }
        if (row < this.size - 1) {
          neighbours.push(this.getNodeAt(row + 1, col));
        }
        if (col > 0) {
          neighbours.push(this.getNodeAt(row, col - 1));
        }
        if (col < this.size - 1) {
          neighbours.push(this.getNodeAt(row, col + 1));
        }

        // Randomize port assignment
        this.shuffle(neighbours, random);

        // Assign local ports starting from 1
        neighbours.forEach((neighbour, index) => {
          node.addPort(index + 1, neighbour);
        });
      }
    }
  }

  // Shuffler
  shuffle(array, random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));

      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Node ID from row and col numbers
  getNodeAt(row, col) {
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      col < 0 ||
      row >= this.size ||
      col >= this.size
    ) {
      return null;
    }

    const id = row * this.size + col;
    return this.nodes.get(id);
  }

  getNodeById(id) {
    return this.nodes.get(id) ?? null;
  }

  getAllNodes() {
    return [...this.nodes.values()];
  }

  getTotalNodes() {
    return this.size * this.size;
  }
}
