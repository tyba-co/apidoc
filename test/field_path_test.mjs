import assert from 'assert';

import { relativeFieldName, splitFieldPath, unquoteField } from '../template/src/field_path.mjs';
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
});
