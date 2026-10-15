import assert from 'assert';

import { bodyKind, bodyMime, hasNotableMime } from '../template/src/body_kind.mjs';

const file = [{ field: 'f', type: 'File' }];
const text = [{ field: 'a', type: 'String' }];

describe('body kind', function () {
  it('should default to json, and to multipart when the body has a file', function () {
    // ASSERT
    assert.strictEqual(bodyKind({ body: text }), 'json');
    assert.strictEqual(bodyKind({ body: file }), 'multipart');
    assert.strictEqual(bodyMime({ body: file }), 'multipart/form-data');
    assert.ok(!hasNotableMime({ body: text }));
  });

  it('should classify a declared content type', function () {
    // ARRANGE
    const kindOf = contentType => bodyKind({ contentType, body: text });

    // ASSERT
    assert.strictEqual(kindOf('application/x-www-form-urlencoded'), 'urlencoded');
    assert.strictEqual(kindOf('multipart/form-data'), 'multipart');
    assert.strictEqual(kindOf('application/vnd.api+json'), 'json');
    assert.strictEqual(kindOf('application/xml'), 'xml');
    assert.strictEqual(kindOf('application/soap+xml'), 'xml');
    assert.strictEqual(kindOf('text/plain'), 'text');
    assert.strictEqual(kindOf('application/octet-stream'), 'binary');
    assert.strictEqual(kindOf('image/png'), 'binary');
  });

  it('should let a declared content type win over the files and mark non default types', function () {
    // ARRANGE
    const declared = { contentType: 'application/json', body: file };

    // ASSERT
    assert.strictEqual(bodyKind(declared), 'json');
    assert.ok(!hasNotableMime(declared));
    assert.ok(hasNotableMime({ contentType: 'text/csv', body: text }));
  });
});
