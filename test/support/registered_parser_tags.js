const fs = require('fs');
const path = require('path');

/**
 * @returns {String[]} lowercase tag names registered in lib/core/index.js app.parsers
 */
function readRegisteredParserTags () {
  const indexSource = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'core', 'index.js'), 'utf8');
  return [...indexSource.matchAll(/(\w+): '\.\/parsers\/\w+\.js'/g)].map(match => match[1]);
}

module.exports = { readRegisteredParserTags };
