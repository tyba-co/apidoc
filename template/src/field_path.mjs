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
