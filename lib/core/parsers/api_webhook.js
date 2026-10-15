function parse (content) {
  return {
    webhook: content.trim() || true,
  };
}

/**
 * Exports
 */
module.exports = {
  parse: parse,
  path: 'local',
  method: 'insert',
};
