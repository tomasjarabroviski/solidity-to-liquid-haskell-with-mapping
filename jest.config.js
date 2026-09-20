module.exports = {
    testEnvironment: "node",
    collectCoverage: true,
    verbose: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: [
      "src/**/*.{js,jsx}",
      "!src/index.js",
      "!src/**/*.test.js",
      "!src/server.js",
      "!src/example1.js",
      "!src/test1.js",
    ],
    coverageReporters: ["text"]
  };