/**
 * Context-aware completion for apidoc comments. Pure functions: the VS Code adapter lives in extension.js.
 */
const tagSnippets = require('../snippets/tags.json');
const blockSnippets = require('../snippets/blocks.json');

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const TYPES = ['String', 'Number', 'Boolean', 'Object', 'String[]', 'Number[]', 'Object[]', 'Date', 'File'];
const EXAMPLE_TYPES = ['json', 'xml', 'js', 'bash', 'http', 'text'];
const STATUSES = {
  Success: ['200 OK', '201 Created', '202 Accepted', '204 No Content'],
  Error: ['400 Bad Request', '401 Unauthorized', '403 Forbidden', '404 Not Found', '409 Conflict', '422 Unprocessable Entity', '500 Internal Server Error'],
};
const FIELD_TAGS = 'Param|Query|Body|Header|Success|Error';

/**
 * @param {String} text
 * @param {Number} offset
 * @returns {Boolean} whether the offset is inside a block comment, a docstring or a line comment
 */
function isInsideComment (text, offset) {
  const before = text.slice(0, offset);
  if (before.lastIndexOf('/**') > before.lastIndexOf('*/')) { return true; }
  if ((before.match(/"""/g) || []).length % 2 === 1) { return true; }
  const lineStart = before.lastIndexOf('\n') + 1;
  return /^\s*(#|\/\/)/.test(before.slice(lineStart));
}

/**
 * What is being typed, from the text of the line before the cursor.
 *
 * @param {String} lineBefore
 * @returns {{kind: String, start: Number, prefix: String, leader: String}|undefined}
 */
function completionContext (lineBefore) {
  const leader = lineBefore.match(/^\s*(?:\/\*\*|\*|#|\/\/)?\s*/)[0];
  const content = lineBefore.slice(leader.length);
  const at = leader.length;
  const patterns = [
    ['tag', /^@(\w*)$/, 0],
    ['method', /^@api\s+\{(\w*)$/, 1],
    ['type', new RegExp(`^@api(?:${FIELD_TAGS})(?:\\s+\\([^)]*\\))?\\s+\\{([\\w\\[\\]|]*)$`), 1],
    ['exampleType', /^@api\w*Example\s+\{(\w*)$/, 1],
    ['status', /^@api(Success|Error)\s+\(([^)]*)$/, 1],
    ['define', /^@api(?:Use|Permission)\s+(\w*)$/, 1],
    ['group', /^@apiGroup\s+(.*)$/, 1],
    ['version', /^@apiVersion\s+(\S*)$/, 1],
  ];
  for (const [kind, pattern, offset] of patterns) {
    const match = content.match(pattern);
    if (!match) { continue; }
    const prefix = match[match.length - 1];
    const start = at + content.length - prefix.length - (kind === 'tag' ? offset + 1 : 0);
    return { kind, start, prefix, leader, which: kind === 'status' ? match[1] : undefined };
  }
  return undefined;
}

/**
 * Names that other comments of the project declare.
 *
 * @param {String} text
 * @returns {{defines: {name: String, title: String}[], groups: String[], versions: String[]}}
 */
function collectNames (text) {
  const defines = [...text.matchAll(/@apiDefine\s+(\w+)[ \t]*([^\n]*)/g)]
    .map(match => ({ name: match[1], title: match[2].replace(/\*\/\s*$/, '').trim() }));
  const groups = [...text.matchAll(/@apiGroup\s+([^\n*]+)/g)].map(match => match[1].trim());
  const versions = [...text.matchAll(/@apiVersion\s+(\d+\.\d+\.\d+[\w.-]*)/g)].map(match => match[1]);
  return { defines, groups, versions };
}

/**
 * @param {Object[]} perFile results of collectNames
 * @returns {{defines: Map, groups: Set, versions: Set}}
 */
function mergeNames (perFile) {
  const merged = { defines: new Map(), groups: new Set(), versions: new Set() };
  perFile.forEach(names => {
    names.defines.forEach(define => { if (!merged.defines.has(define.name) || define.title) { merged.defines.set(define.name, define.title); } });
    names.groups.forEach(group => merged.groups.add(group));
    names.versions.forEach(version => merged.versions.add(version));
  });
  return merged;
}

const plain = (label, detail, extra) => Object.assign({ label, detail, insert: label, isSnippet: false }, extra);

/**
 * @param {Object} context result of completionContext
 * @param {{defines: Map, groups: Set, versions: Set}} names
 * @returns {Object[]} items with label, detail, insert and isSnippet
 */
function itemsFor (context, names) {
  const separator = context.leader.trim() === '' ? '\n' : `\n${context.leader}`;
  switch (context.kind) {
    case 'tag':
      return Object.values(tagSnippets).map(snippet => ({
        label: snippet.prefix,
        detail: snippet.description,
        insert: snippet.body.join(separator),
        isSnippet: true,
      }));
    case 'method':
      return METHODS.map(method => plain(method, 'HTTP method'));
    case 'type':
      return TYPES.map(type => plain(type, 'field type'));
    case 'exampleType':
      return EXAMPLE_TYPES.map(type => plain(type, 'highlight language'));
    case 'status':
      return STATUSES[context.which].map(status => plain(status, 'status group', { insert: `${status})` }));
    case 'define':
      return [...names.defines].map(([name, title]) => plain(name, title || '@apiDefine'));
    case 'group':
      return [...names.groups].sort().map(group => plain(group, 'existing group'));
    case 'version':
      return [...names.versions].sort().map(version => plain(version, 'existing version'));
    default:
      return [];
  }
}

/**
 * The apidoc / apidocdefine block snippets, for languages VS Code cannot hold snippets for without their language extension.
 *
 * @param {String} lineBefore
 * @returns {{start: Number, items: Object[]}|undefined}
 */
function blockCompletions (lineBefore) {
  const typed = lineBefore.match(/(?:^|\s)(apid\w*)$/);
  if (!typed) { return undefined; }
  const items = Object.values(blockSnippets).map(snippet => ({
    label: snippet.prefix,
    detail: snippet.description,
    insert: snippet.body.join('\n'),
    isSnippet: true,
  }));
  return { start: lineBefore.length - typed[1].length, items };
}

/**
 * @param {Object} input
 * @param {String} input.text whole document
 * @param {Number} input.offset cursor offset in the document
 * @param {String} input.lineBefore text of the cursor line before the cursor
 * @param {Object} input.names result of mergeNames
 * @param {Boolean} [input.withBlocks] also offer the block snippets outside comments
 * @returns {{start: Number, items: Object[]}|undefined} start is the column where the replaced text begins
 */
function getCompletions ({ text, offset, lineBefore, names, withBlocks }) {
  if (!isInsideComment(text, offset)) { return withBlocks ? blockCompletions(lineBefore) : undefined; }
  const context = completionContext(lineBefore);
  if (!context) { return undefined; }
  return { start: context.start, items: itemsFor(context, names) };
}

module.exports = { collectNames, completionContext, getCompletions, isInsideComment, mergeNames };
