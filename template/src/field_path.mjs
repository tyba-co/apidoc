/**
 * Helpers for field names that may hold a "quoted.segment": a literal key containing a dot.
 */

/**
 * @param {String} field
 * @returns {String}
 */
export const unquoteField = field => field.replace(/"/g, '');

/**
 * @param {String} path dotted field path
 * @returns {String[]}
 */
export const splitFieldPath = path => (path.match(/"[^"]*"|[^.]+/g) || []).map(unquoteField);

/**
 * Field name relative to its parent node, without quotes.
 *
 * @param {String} field
 * @param {Object} [parentNode]
 * @returns {String}
 */
export const relativeFieldName = (field, parentNode) => {
  return unquoteField(parentNode ? field.substring(parentNode.path.length + 1) : field);
};

/**
 * Name of a field as a form part, with brackets for nesting and arrays: extraInfo[hireDate], tags[].
 *
 * @param {Object} entry @apiBody / @apiParam entry with field, parentNode and isArray
 * @returns {String}
 */
export function formFieldName (entry) {
  const { parentNode, field, isArray } = entry;
  if (!parentNode) { return unquoteField(field) + (isArray ? '[]' : ''); }

  let name = '';
  let current = entry;
  do {
    const parent = current.parentNode;
    if (parent.isArray) { name = `[]${name}`; }
    name = parent.parentNode ? `[${relativeFieldName(parent.field, parent.parentNode)}]${name}` : unquoteField(parent.field) + name;
    current = parent;
  } while (current.parentNode);
  return `${name}[${relativeFieldName(field, parentNode)}]`;
}
