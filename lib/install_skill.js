const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const skillSourceDir = path.join(__dirname, '..', 'skills', 'apidoc');

/**
 * Copy the bundled apidoc agent skill to <baseDir>/.claude/skills/apidoc, replacing any previous copy.
 *
 * @param {String} baseDir project root, or the home directory for a global install
 * @returns {String} directory the skill was written to
 */
function installClaudeSkill (baseDir) {
  const skillDestinationDir = path.join(baseDir, '.claude', 'skills', 'apidoc');
  fs.emptyDirSync(skillDestinationDir);
  fs.copySync(skillSourceDir, skillDestinationDir);
  return skillDestinationDir;
}

/**
 * Run `apidoc install-skill [--global]`.
 *
 * @param {String[]} args arguments after `install-skill`
 * @returns {Number} process exit code
 */
function runInstallSkillCommand (args) {
  const unknownArgs = args.filter(arg => arg !== '--global');
  if (unknownArgs.length > 0) {
    console.error(`[error] Unknown argument: ${unknownArgs.join(' ')}. Usage: apidoc install-skill [--global]`);
    return 1;
  }
  const skillDestinationDir = installClaudeSkill(args.includes('--global') ? os.homedir() : process.cwd());
  console.log(`apidoc skill installed in ${skillDestinationDir}`);
  return 0;
}

module.exports = {
  installClaudeSkill,
  runInstallSkillCommand,
};
