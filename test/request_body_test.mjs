import assert from 'assert';

import { buildRequestBody } from '../template/src/request_body.mjs';

describe('request body', function () {
  it('should send json and text as given, with their content type', function () {
    // ASSERT
    assert.deepStrictEqual(buildRequestBody({ encoding: 'json', text: '{"a":1}' }), { data: '{"a":1}', contentType: 'application/json' });
    assert.deepStrictEqual(buildRequestBody({ encoding: 'text', text: '<a/>', mime: 'application/xml' }), { data: '<a/>', contentType: 'application/xml' });
    assert.strictEqual(buildRequestBody({ encoding: 'json' }).data, '');
  });

  it('should encode urlencoded values and repeat the name of an array', function () {
    // ACT
    const { data, contentType } = buildRequestBody({ encoding: 'urlencoded', values: { user: 'ana@example.com', scope: ['read', 'write'], 'a[b]': 'x y' } });

    // ASSERT
    assert.strictEqual(data, 'user=ana%40example.com&scope=read&scope=write&a%5Bb%5D=x+y');
    assert.strictEqual(contentType, 'application/x-www-form-urlencoded; charset=UTF-8');
  });

  it('should send a binary body with the mime of the file when none is declared', function () {
    // ARRANGE
    const file = new File(['abc'], 'a.png', { type: 'image/png' });

    // ASSERT
    assert.strictEqual(buildRequestBody({ encoding: 'binary', file }).data, file);
    assert.strictEqual(buildRequestBody({ encoding: 'binary', file }).contentType, 'image/png');
    assert.strictEqual(buildRequestBody({ encoding: 'binary', file, mime: 'application/octet-stream' }).contentType, 'application/octet-stream');
  });

  it('should append every value to the multipart form, files included, and leave the content type to the browser', function () {
    // ARRANGE
    const file = new File(['name,age\n'], 'users.csv', { type: 'text/csv' });

    // ACT
    const { data, contentType } = buildRequestBody({ encoding: 'multipart', values: { users: file, dryRun: 'on', tags: ['a', 'b'] } });

    // ASSERT
    assert.strictEqual(contentType, false);
    assert.ok(data.get('users') instanceof File);
    assert.strictEqual(data.get('users').name, 'users.csv');
    assert.deepStrictEqual(data.getAll('tags'), ['a', 'b']);
    assert.strictEqual(data.get('dryRun'), 'on');
  });
});
