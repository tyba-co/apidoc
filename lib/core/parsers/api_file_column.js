// Same grammar as @apiParam; the (group) names the File field of the body the column belongs to
const apiParser = require('./api_param.js');

const UNSPECIFIED_FILE = 'Columns';

function parse (content, source) {
  return apiParser.parse(content, source, UNSPECIFIED_FILE);
}

/**
 * Exports
 */
module.exports = {
  parse: parse,
  path: 'local.fileColumns',
  method: apiParser.method,
  markdownFields: ['description'],
};
