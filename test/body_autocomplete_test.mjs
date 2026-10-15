import assert from 'assert';

import { analyzeCursor, applySuggestion, autocompleteFields, buildFieldTree, suggest } from '../template/src/body_autocomplete.mjs';

const extraInfo = { path: 'extraInfo' };
const secrets = { path: 'extraInfo.secrets' };
const deepSecrets = { path: 'extraInfo.secrets.deepSecrets' };

const tree = buildFieldTree(autocompleteFields([
  { field: 'age', type: 'Number' },
  { field: 'name', type: 'String', defaultValue: 'Caroline', description: '<p>Name of the <b>User</b></p>' },
  { field: 'status', type: 'String', optional: true, allowedValues: ['"ACTIVE"', '"BLOCKED"'] },
  { field: 'extraInfo', type: 'Object' },
  { field: 'extraInfo.hireDate', type: 'Date', parentNode: extraInfo },
  { field: 'extraInfo.isVegan', type: 'Boolean', defaultValue: 'true', parentNode: extraInfo },
  { field: 'extraInfo.secrets', type: 'Object', parentNode: extraInfo },
  { field: 'extraInfo.secrets.deepSecrets', type: 'Object[]', parentNode: secrets },
  { field: 'extraInfo.secrets.deepSecrets.key', type: 'String', parentNode: deepSecrets },
  { field: 'extraInfo.secrets.deepSecrets.name.particle', type: 'String', parentNode: deepSecrets },
  { field: '"custom.property"', type: 'String' },
]));

/**
 * @param {String} markedText text with a "|" where the cursor is
 * @returns {{text: String, cursor: Number}}
 */
const withCursor = markedText => ({ text: markedText.replace('|', ''), cursor: markedText.indexOf('|') });

/**
 * @param {String} markedText text with a "|" where the cursor is
 * @returns {Object[]}
 */
const suggestionsAt = markedText => {
  const { text, cursor } = withCursor(markedText);
  return suggest(tree, text, cursor).suggestions;
};

describe('body autocomplete', function () {
  it('should describe the fields with parent path, relative key and plain description', function () {
    // ARRANGE
    const fields = [{ field: 'extraInfo.secrets.deepSecrets.name.particle', type: 'String', parentNode: deepSecrets, description: '<p>A  <em>deep</em> name</p>' }];

    // ACT
    const [described] = autocompleteFields(fields);

    // ASSERT
    assert.deepStrictEqual(described.path, ['extraInfo', 'secrets', 'deepSecrets']);
    assert.strictEqual(described.key, 'name.particle');
    assert.strictEqual(described.description, 'A deep name');
  });

  it('should offer every root key at the start of an object, with a value template', function () {
    // ARRANGE
    const { text, cursor } = withCursor('{\n  |\n}');

    // ACT
    const { suggestions } = suggest(tree, text, cursor);
    const age = suggestions.find(entry => entry.label === 'age');

    // ASSERT
    assert.deepStrictEqual(suggestions.map(entry => entry.label), ['age', 'name', 'status', 'extraInfo', 'custom.property']);
    assert.strictEqual(age.detail, 'Number · required');
    assert.strictEqual(applySuggestion(text, age).text, '{\n  "age": 0\n}');
  });

  it('should complete a key being typed inside quotes and place the cursor in the value', function () {
    // ARRANGE
    const { text, cursor } = withCursor('{ "na|');

    // ACT
    const [name] = suggest(tree, text, cursor).suggestions;
    const applied = applySuggestion(text, name);

    // ASSERT
    assert.strictEqual(applied.text, '{ "name": "Caroline"');
    assert.strictEqual(applied.caret, applied.text.length);
  });

  it('should leave the cursor inside empty quotes, braces or brackets by type', function () {
    // ARRANGE
    const pick = (markedText, label) => {
      const { text, cursor } = withCursor(markedText);
      const entry = suggest(tree, text, cursor).suggestions.find(candidate => candidate.label === label);
      return applySuggestion(text, entry);
    };

    // ACT
    const asString = pick('{ "st|', 'status');
    const asObject = pick('{ "ex|', 'extraInfo');

    // ASSERT
    assert.strictEqual(asString.text.slice(0, asString.caret), '{ "status": "');
    assert.strictEqual(asObject.text.slice(0, asObject.caret), '{ "extraInfo": {');
  });

  it('should not offer keys that the object already has', function () {
    // ACT
    const labels = suggestionsAt('{ "age": 1, "|').map(entry => entry.label);

    // ASSERT
    assert.ok(!labels.includes('age'));
    assert.ok(labels.includes('name'));
  });

  it('should offer the children of the object that holds the cursor, through arrays', function () {
    // ACT
    const nested = suggestionsAt('{ "extraInfo": { "|').map(entry => entry.label);
    const deep = suggestionsAt('{ "extraInfo": { "secrets": { "deepSecrets": [ { "|').map(entry => entry.label);

    // ASSERT
    assert.deepStrictEqual(nested, ['hireDate', 'isVegan', 'secrets']);
    assert.deepStrictEqual(deep, ['key', 'name.particle']);
  });

  it('should replace only the key name when editing a complete key', function () {
    // ARRANGE
    const { text, cursor } = withCursor('{ "ag|": 0 }');

    // ACT
    const [age] = suggest(tree, text, cursor).suggestions;

    // ASSERT
    assert.strictEqual(applySuggestion(text, age).text, '{ "age": 0 }');
  });

  it('should add a comma when another key follows', function () {
    // ARRANGE
    const { text, cursor } = withCursor('{\n  |\n  "age": 1\n}');

    // ACT
    const name = suggest(tree, text, cursor).suggestions.find(entry => entry.label === 'name');

    // ASSERT
    assert.strictEqual(applySuggestion(text, name).text, '{\n  "name": "Caroline",\n  "age": 1\n}');
  });

  it('should suggest booleans and allowed values for the key before the cursor', function () {
    // ACT
    const booleans = suggestionsAt('{ "extraInfo": { "isVegan": |').map(entry => entry.label);
    const allowed = suggestionsAt('{ "status": "A|').map(entry => entry.label);
    const { text, cursor } = withCursor('{ "status": "B|');
    const blocked = suggest(tree, text, cursor).suggestions[0];

    // ASSERT
    assert.deepStrictEqual(booleans, ['true', 'false']);
    assert.deepStrictEqual(allowed, ['ACTIVE']);
    assert.strictEqual(applySuggestion(text, blocked).text, '{ "status": "BLOCKED"');
  });

  it('should suggest nothing for free values and outside objects', function () {
    // ACT
    const freeValue = suggestionsAt('{ "name": "|');
    const inArray = suggestionsAt('[ "|');
    const kind = analyzeCursor('', 0).kind;

    // ASSERT
    assert.deepStrictEqual(freeValue, []);
    assert.deepStrictEqual(inArray, []);
    assert.strictEqual(kind, 'none');
  });
});
