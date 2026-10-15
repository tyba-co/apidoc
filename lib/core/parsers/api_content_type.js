const ParameterError = require('../errors/parameter_error');

const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+*-]*$/;

function parse (content) {
  const mimeType = content.trim().toLowerCase();

  if (mimeType.length === 0) { return null; }

  if (!MIME_TYPE.test(mimeType)) {
    throw new ParameterError('Content type not valid.',
      'apiContentType', '@apiContentType type/subtype', '@apiContentType application/x-www-form-urlencoded');
  }

  return {
    contentType: mimeType,
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
