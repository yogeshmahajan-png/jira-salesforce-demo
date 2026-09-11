"use strict";

class GitService {
  constructor(terminal) {
    this.terminal = terminal;
  }

  status() {
    return this.terminal.run("git", ["status", "--short"]);
  }

  branch() {
    return this.terminal.run("git", ["branch", "--show-current"]);
  }
}

module.exports = { GitService };
