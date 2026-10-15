/**
 * Dotted path of every object key in a JSON text, in document order.
 * Arrays add no segment, matching how @apiBody names nested fields.
 * A key that contains a dot is quoted, like a "literal.key" segment in an @apiBody field.
 *
 * @param {String} text
 * @returns {String[]}
 */
export function jsonKeyPaths (text) {
  const paths = [];
  const frames = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') {
        end += text[end] === '\\' ? 2 : 1;
      }
      const key = text.slice(i + 1, end);
      const top = frames[frames.length - 1];
      const isKey = top && top.isObject && /^\s*:/.test(text.slice(end + 1));
      if (isKey) {
        top.current = key.includes('.') ? `"${key}"` : key;
        paths.push(frames.filter(frame => frame.isObject).map(frame => frame.current).join('.'));
      }
      i = end + 1;
      continue;
    }
    if (char === '{' || char === '[') {
      frames.push({ isObject: char === '{' });
    } else if (char === '}' || char === ']') {
      frames.pop();
    }
    i += 1;
  }

  return paths;
}

/**
 * Tooltip text per @apiBody field path, e.g. { 'extraInfo.hireDate': 'Date · required' }.
 *
 * @param {Object[]} fields @apiBody entries with `field`, `type` and `optional`
 * @param {String} requiredLabel
 * @param {String} optionalLabel
 * @returns {Object}
 */
export function bodyFieldLabels (fields, requiredLabel, optionalLabel) {
  const labels = {};
  fields.forEach(({ field, type, optional }) => {
    labels[field] = `${type} · ${optional ? optionalLabel : requiredLabel}`;
  });
  return labels;
}
