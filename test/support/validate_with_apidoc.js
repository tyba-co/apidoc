const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const apidocBin = path.join(__dirname, '..', '..', 'bin', 'apidoc');

/**
 * Run apidoc --dry-run --warn-error over a project that holds only the given source.
 *
 * @param {String} source apidoc comment blocks
 * @returns {Number} exit code
 */
function validateWithApidoc (source) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-example-'));
  try {
    fs.writeFileSync(path.join(projectDir, 'apidoc.json'), JSON.stringify({ name: 'example', version: '1.0.0', description: 'example' }));
    fs.writeFileSync(path.join(projectDir, 'example.js'), source);
    const result = spawnSync(process.execPath, [apidocBin, '-i', projectDir, '-o', path.join(projectDir, 'out'), '-n', '--warn-error'], { encoding: 'utf8' });
    return result.status;
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

module.exports = { validateWithApidoc };
