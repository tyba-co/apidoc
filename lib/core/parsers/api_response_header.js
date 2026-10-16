// Same as @apiHeader, but for the headers of the response
const apiParser = require('./api_param.js');

function parse (content, source) {
  return apiParser.parse(content, source, 'Response Headers');
}

function path () {
  return 'local.responseHeader.fields.' + apiParser.getGroup();
}

/**
 * Exports
 */
module.exports = {
  parse: parse,
  path: path,
  method: apiParser.method,
  markdownFields: ['description'],
};
