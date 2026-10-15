import assert from 'assert';

import { bodyFieldLabels, jsonKeyPaths } from '../template/src/body_example_hover.mjs';

describe('body example hover', function () {
  it('should list dotted key paths in document order', function () {
    // ARRANGE
    const text = JSON.stringify({
      name: 'Caroline',
      extraInfo: { hireDate: '2021-09-01', secrets: { deepSecrets: [{ key: 'a', number: 1 }] } },
      'custom.property': 'x',
    }, null, 4);

    // ACT
    const paths = jsonKeyPaths(text);

    // ASSERT
    assert.deepStrictEqual(paths, [
      'name',
      'extraInfo',
      'extraInfo.hireDate',
      'extraInfo.secrets',
      'extraInfo.secrets.deepSecrets',
      'extraInfo.secrets.deepSecrets.key',
      'extraInfo.secrets.deepSecrets.number',
      '"custom.property"',
    ]);
  });

  it('should not treat string values or escaped quotes as keys', function () {
    // ARRANGE
    const text = '{ "a": "b: c", "d": "say \\"e\\": f", "g": ["h", { "i": 1 }] }';

    // ACT
    const paths = jsonKeyPaths(text);

    // ASSERT
    assert.deepStrictEqual(paths, ['a', 'd', 'g', 'g.i']);
  });

  it('should label fields with type and requirement', function () {
    // ARRANGE
    const fields = [
      { field: 'age', type: 'Number', optional: false },
      { field: 'extraInfo.nicknames', type: 'String[]', optional: true },
    ];

    // ACT
    const labels = bodyFieldLabels(fields, 'required', 'optional');

    // ASSERT
    assert.deepStrictEqual(labels, {
      age: 'Number · required',
      'extraInfo.nicknames': 'String[] · optional',
    });
  });
});
