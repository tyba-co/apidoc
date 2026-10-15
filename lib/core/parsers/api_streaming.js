const TYPE_AND_DESCRIPTION = /^(?:\{([\w.+/-]+)\}\s*)?([\s\S]*)$/;

function parse (content) {
  const match = content.trim().match(TYPE_AND_DESCRIPTION);

  return {
    streaming: {
      type: match[1] || 'stream',
      description: match[2].trim(),
    },
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
