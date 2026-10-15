/**
 * Autocompletion of the JSON body of a sample request, driven by the @apiBody fields.
 */
import { relativeFieldName, splitFieldPath } from './field_path.mjs';

const stripHtml = text => (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const stripQuotes = value => value.replace(/^["']|["']$/g, '');

/**
 * Plain, serializable description of the @apiBody fields.
 *
 * @param {Object[]} fields parsed @apiBody entries
 * @returns {Object[]}
 */
export function autocompleteFields (fields) {
  return fields.map(({ field, parentNode, type, optional, description, defaultValue, allowedValues }) => ({
    path: parentNode ? splitFieldPath(parentNode.path) : [],
    key: relativeFieldName(field, parentNode),
    type,
    optional: Boolean(optional),
    description: stripHtml(description).slice(0, 120),
    defaultValue,
    allowedValues: (allowedValues || []).map(stripQuotes),
  }));
}

/**
 * @param {Object[]} fields result of autocompleteFields
 * @returns {{children: Map}} tree of the fields that can appear in the body
 */
export function buildFieldTree (fields) {
  const root = { children: new Map() };
  fields.forEach(field => {
    let parent = root;
    field.path.forEach(segment => {
      if (!parent.children.has(segment)) { parent.children.set(segment, { key: segment, type: 'Object', children: new Map() }); }
      parent = parent.children.get(segment);
    });
    const existing = parent.children.get(field.key);
    parent.children.set(field.key, Object.assign({}, field, { children: existing ? existing.children : new Map() }));
  });
  return root;
}

/**
 * Tokenize the text enough to know which object holds each position.
 *
 * @param {String} text
 * @returns {{frames: Object[], strings: Object[]}}
 */
function scanJson (text) {
  const frames = [];
  const strings = [];
  const stack = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const top = stack[stack.length - 1];
    if (char === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') { end += text[end] === '\\' ? 2 : 1; }
      const terminated = end < text.length;
      const isKey = Boolean(top && top.isObject && top.expectingKey);
      const token = { start: index, end: terminated ? end + 1 : text.length, value: text.slice(index + 1, Math.min(end, text.length)), terminated, isKey, frame: top, key: top && top.lastKey };
      strings.push(token);
      if (isKey) {
        top.keys.push(token.value);
        top.lastKey = token.value;
        top.expectingKey = false;
      }
      index = token.end;
      continue;
    }
    if (char === '{' || char === '[') {
      const frame = { isObject: char === '{', start: index, end: text.length, keys: [], expectingKey: char === '{', path: stack.filter(open => open.isObject).map(open => open.lastKey) };
      frames.push(frame);
      stack.push(frame);
    } else if (char === '}' || char === ']') {
      const closed = stack.pop();
      if (closed) { closed.end = index; }
    } else if (char === ',' && top && top.isObject) {
      top.expectingKey = true;
    }
    index += 1;
  }

  return { frames, strings };
}

/**
 * What is being typed at the cursor.
 *
 * @param {String} text
 * @param {Number} cursor
 * @returns {Object} kind 'key' | 'value' | 'none', plus path, prefix, inString and the string token if any
 */
export function analyzeCursor (text, cursor) {
  const { frames, strings } = scanJson(text);

  const token = strings.find(candidate => cursor >= candidate.start + 1 && cursor <= (candidate.terminated ? candidate.end - 1 : candidate.end));
  if (token) {
    const frame = token.frame;
    const prefix = text.slice(token.start + 1, cursor);
    if (token.isKey) {
      return { kind: 'key', path: frame.path, existing: frame.keys.filter(key => key !== token.value), prefix, inString: true, token };
    }
    if (frame && frame.isObject) { return { kind: 'value', path: frame.path, key: token.key, prefix, inString: true, token }; }
    return { kind: 'none' };
  }

  const frame = frames.filter(candidate => cursor > candidate.start && cursor <= candidate.end).pop();
  if (!frame || !frame.isObject) { return { kind: 'none' }; }
  const before = text.slice(frame.start + 1, cursor).trimEnd();
  const lastChar = before.slice(-1);
  const keyBeforeCursor = strings.filter(candidate => candidate.isKey && candidate.frame === frame && candidate.end <= cursor).pop();
  const key = keyBeforeCursor && keyBeforeCursor.value;
  if (lastChar === '' || lastChar === ',') {
    return { kind: 'key', path: frame.path, existing: frame.keys, prefix: '', inString: false };
  }
  if (lastChar === ':') {
    return { kind: 'value', path: frame.path, key, prefix: '', inString: false };
  }
  const word = before.match(/:\s*([\w.+-]+)$/);
  if (word) {
    return { kind: 'value', path: frame.path, key, prefix: word[1], inString: false };
  }
  return { kind: 'none' };
}

/**
 * Initial value written after a key, with the offset where the cursor lands.
 *
 * @param {Object} node field of the tree
 * @returns {{text: String, caret: Number}}
 */
function valueTemplate (node) {
  const type = (node.type || '').toLowerCase();
  const hasDefault = node.defaultValue !== undefined && node.defaultValue !== '';
  if (type.includes('[]')) { return type.includes('object') ? { text: '[{}]', caret: 2 } : { text: '[]', caret: 1 }; }
  if (type.includes('object')) { return { text: '{}', caret: 1 }; }
  if (type === 'boolean') { return { text: String(Boolean(node.defaultValue)), caret: String(Boolean(node.defaultValue)).length }; }
  if (type === 'number') {
    const text = String(parseInt(node.defaultValue || 0, 10));
    return { text, caret: text.length };
  }
  if (hasDefault) {
    const text = `"${node.defaultValue}"`;
    return { text, caret: text.length };
  }
  return { text: '""', caret: 1 };
}

const startsWithIgnoringCase = (value, prefix) => value.toLowerCase().startsWith(prefix.toLowerCase());

/**
 * @param {Object} node parent field of the keys being typed
 * @param {Object} context result of analyzeCursor
 * @param {String} text
 * @param {Number} cursor
 * @returns {Object[]}
 */
function keySuggestions (node, context, text, cursor) {
  const followedByAnotherKey = from => /^\s*"/.test(text.slice(from));
  return [...node.children.values()]
    .filter(child => !context.existing.includes(child.key) && startsWithIgnoringCase(child.key, context.prefix))
    .map(child => {
      const base = { label: child.key, detail: `${child.type} · ${child.optional ? 'optional' : 'required'}`, description: child.description };
      const token = context.token;
      if (token && token.terminated) {
        return Object.assign(base, { from: token.start + 1, to: token.end - 1, insert: child.key, caret: token.start + 1 + child.key.length });
      }
      const template = valueTemplate(child);
      const from = token ? token.start + 1 : cursor;
      const head = token ? `${child.key}": ` : `"${child.key}": `;
      const comma = followedByAnotherKey(cursor) ? ',' : '';
      return Object.assign(base, { from, to: cursor, insert: head + template.text + comma, caret: from + head.length + template.caret });
    });
}

/**
 * @param {Object} node parent field of the key whose value is being typed
 * @param {Object} context result of analyzeCursor
 * @param {Number} cursor
 * @returns {Object[]}
 */
function valueSuggestions (node, context, cursor) {
  const field = node.children.get(context.key);
  if (!field) { return []; }
  const type = (field.type || '').toLowerCase();
  const options = type === 'boolean' ? ['true', 'false'] : field.allowedValues || [];
  const isText = type !== 'number' && type !== 'boolean';
  return options
    .filter(option => startsWithIgnoringCase(option, context.prefix))
    .map(option => {
      const base = { label: option, detail: type === 'boolean' ? 'Boolean' : 'allowed value' };
      const token = context.token;
      if (token) {
        const insert = token.terminated ? option : `${option}"`;
        const to = token.terminated ? token.end - 1 : cursor;
        return Object.assign(base, { from: token.start + 1, to, insert, caret: token.start + 1 + option.length + 1 });
      }
      const insert = isText ? `"${option}"` : option;
      const from = cursor - context.prefix.length;
      return Object.assign(base, { from, to: cursor, insert, caret: from + insert.length });
    });
}

/**
 * @param {{children: Map}} tree result of buildFieldTree
 * @param {String} text
 * @param {Number} cursor
 * @returns {{suggestions: Object[], context: Object}}
 */
export function suggest (tree, text, cursor) {
  const context = analyzeCursor(text, cursor);
  if (context.kind === 'none') { return { suggestions: [], context }; }

  let node = tree;
  for (const segment of context.path) {
    node = node && node.children.get(segment);
  }
  if (!node) { return { suggestions: [], context }; }

  const suggestions = context.kind === 'key'
    ? keySuggestions(node, context, text, cursor)
    : valueSuggestions(node, context, cursor);
  return { suggestions, context };
}

/**
 * @param {String} text
 * @param {Object} suggestion one entry of suggest().suggestions
 * @returns {{text: String, caret: Number}}
 */
export function applySuggestion (text, suggestion) {
  return { text: text.slice(0, suggestion.from) + suggestion.insert + text.slice(suggestion.to), caret: suggestion.caret };
}
