/**
 * install-skill tests
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { installClaudeSkill } = require('../lib/install_skill');

const repoRoot = path.join(__dirname, '..');
const apidocBin = path.join(repoRoot, 'bin', 'apidoc');
const skillSourceFile = path.join(repoRoot, 'skills', 'apidoc', 'SKILL.md');

/**
 * @returns {String} new empty temporary directory
 */
function createTemporaryProject () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-install-skill-'));
}

describe('install-skill', function () {
  const temporaryProjects = [];

  after(function () {
    temporaryProjects.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
  });

  it('copies the skill into <dir>/.claude/skills/apidoc', function () {
    // ARRANGE
    const projectDir = createTemporaryProject();
    temporaryProjects.push(projectDir);

    // ACT
    const skillDir = installClaudeSkill(projectDir);

    // ASSERT
    assert.strictEqual(skillDir, path.join(projectDir, '.claude', 'skills', 'apidoc'));
    assert.strictEqual(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'), fs.readFileSync(skillSourceFile, 'utf8'));
    assert.ok(fs.existsSync(path.join(skillDir, 'references', 'tags.md')));
  });

  it('replaces files left by a previous install', function () {
    // ARRANGE
    const projectDir = createTemporaryProject();
    temporaryProjects.push(projectDir);
    const staleFile = path.join(projectDir, '.claude', 'skills', 'apidoc', 'references', 'stale.md');
    fs.mkdirSync(path.dirname(staleFile), { recursive: true });
    fs.writeFileSync(staleFile, 'stale');

    // ACT
    installClaudeSkill(projectDir);

    // ASSERT
    assert.ok(!fs.existsSync(staleFile));
  });

  it('installs from the CLI into the current directory', function () {
    // ARRANGE
    const projectDir = createTemporaryProject();
    temporaryProjects.push(projectDir);

    // ACT
    const result = spawnSync(process.execPath, [apidocBin, 'install-skill'], { cwd: projectDir, encoding: 'utf8' });

    // ASSERT
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(projectDir, '.claude', 'skills', 'apidoc', 'SKILL.md')));
  });

  it('rejects unknown CLI arguments without writing files', function () {
    // ARRANGE
    const projectDir = createTemporaryProject();
    temporaryProjects.push(projectDir);

    // ACT
    const result = spawnSync(process.execPath, [apidocBin, 'install-skill', '--cursor'], { cwd: projectDir, encoding: 'utf8' });

    // ASSERT
    assert.strictEqual(result.status, 1);
    assert.ok(!fs.existsSync(path.join(projectDir, '.claude')));
  });
});
