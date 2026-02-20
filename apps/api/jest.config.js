// Ensure test environment is set before anything loads
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  globalSetup: '<rootDir>/__tests__/setup.js',
  globalTeardown: '<rootDir>/__tests__/teardown.js',
  testTimeout: 15000,
  verbose: true,
  // Coverage settings
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
