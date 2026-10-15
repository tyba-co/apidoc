import assert from 'assert';

import { formFieldName, relativeFieldName, splitFieldPath, unquoteField } from '../template/src/field_path.mjs';
import { body2json } from '../template/src/jsonifier.mjs';

describe('field path', function () {
  it('should split on dots outside quotes and drop the quotes', function () {
    // ARRANGE
    const path = 'extraInfo."name.particle".deep';

    // ACT
    const segments = splitFieldPath(path);

    // ASSERT
    assert.deepStrictEqual(segments, ['extraInfo', 'name.particle', 'deep']);
  });

  it('should name a field relative to its parent without quotes', function () {
    // ARRANGE
    const parentNode = { path: 'extraInfo' };

    // ACT
    const nested = relativeFieldName('extraInfo."name.particle"', parentNode);
    const root = relativeFieldName('"custom.property"');

    // ASSERT
    assert.strictEqual(nested, 'name.particle');
    assert.strictEqual(root, 'custom.property');
    assert.strictEqual(unquoteField('"a.b"'), 'a.b');
  });

  it('should build the body with a literal dotted key under a declared parent', function () {
    // ARRANGE
    const parentNode = { path: 'extraInfo', type: 'Object' };
    const fields = [
      { field: 'extraInfo', type: 'Object' },
      { parentNode, field: 'extraInfo."name.particle"', type: 'String', defaultValue: 'x' },
      { field: '"custom.property"', type: 'String', defaultValue: 'y' },
    ];

    // ACT
    const body = JSON.parse(body2json(fields));

    // ASSERT
    assert.deepStrictEqual(body, { extraInfo: { 'name.particle': 'x' }, 'custom.property': 'y' });
  });

  it('should name form parts with brackets for nesting and arrays', function () {
    // ARRANGE
    const extraInfo = { field: 'extraInfo', type: 'Object' };
    const secrets = { field: 'extraInfo.secrets', type: 'Object[]', isArray: true, parentNode: Object.assign({ path: 'extraInfo' }, extraInfo) };
    const key = { field: 'extraInfo.secrets.key', type: 'String', parentNode: Object.assign({ path: 'extraInfo.secrets' }, secrets) };
    const hireDate = { field: 'extraInfo.hireDate', type: 'Date', parentNode: Object.assign({ path: 'extraInfo' }, extraInfo) };

    // ACT
    const names = [{ field: 'age' }, { field: 'tags', isArray: true }, { field: '"custom.property"' }, hireDate, key].map(formFieldName);

    // ASSERT
    assert.deepStrictEqual(names, ['age', 'tags[]', 'custom.property', 'extraInfo[hireDate]', 'extraInfo[secrets][][key]']);
  });
});
