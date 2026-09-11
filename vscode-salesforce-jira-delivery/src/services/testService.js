"use strict";

class TestService {
  constructor(terminal) {
    this.terminal = terminal;
  }

  runUnitTests() {
    return this.terminal.run("npm", ["test"]);
  }

  generateReport() {
    return this.terminal.run("npm", ["run", "story:report"]);
  }
}

module.exports = { TestService };
