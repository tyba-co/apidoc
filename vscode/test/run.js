/**
 * Runs the host tests inside a real VS Code. Set VSCODE_EXECUTABLE_PATH to reuse an installed one;
 * otherwise a build is downloaded into .vscode-test.
 */
const path = require('path');
const { runTests } = require('@vscode/test-electron');

runTests({
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
  extensionDevelopmentPath: path.resolve(__dirname, '..'),
  extensionTestsPath: path.resolve(__dirname, 'suite', 'index.js'),
  launchArgs: [path.resolve(__dirname, 'fixtures', 'workspace'), '--disable-extensions', '--disable-workspace-trust'],
}).catch(error => {
  console.error(error);
  process.exit(1);
});
