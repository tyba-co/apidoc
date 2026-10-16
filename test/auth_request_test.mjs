import assert from 'assert';

import { authorizedSchemes, authRequest, inEnvironment, withQuery } from '../template/src/auth_request.mjs';

const schemes = [
  { name: 'Bearer token', type: 'bearer' },
  { name: 'Key', type: 'apiKey', in: 'header', param: 'X-Api-Key' },
  { name: 'Query key', type: 'apiKey', in: 'query', param: 'api_key' },
  { name: 'Basic', type: 'basic' },
];

describe('auth request', function () {
  it('should put a bearer token in the Authorization header, with a custom header and prefix when set', function () {
    // ASSERT
    assert.deepStrictEqual(authRequest(schemes, { 'Bearer token': { token: 'abc' } }), { headers: { Authorization: 'Bearer abc' }, query: {} });
    assert.deepStrictEqual(authRequest([{ name: 'T', type: 'bearer', header: 'X-Auth', prefix: 'Token' }], { T: { token: 'abc' } }).headers, { 'X-Auth': 'Token abc' });
  });

  it('should send an api key in a header or in the query', function () {
    // ACT
    const result = authRequest(schemes, { Key: { value: 'k1' }, 'Query key': { value: 'k 2' } });

    // ASSERT
    assert.deepStrictEqual(result.headers, { 'X-Api-Key': 'k1' });
    assert.deepStrictEqual(result.query, { api_key: 'k 2' });
  });

  it('should encode basic credentials as UTF-8 base64', function () {
    // ASSERT
    assert.strictEqual(authRequest(schemes, { Basic: { username: 'ana', password: 'secreto' } }).headers.Authorization, 'Basic YW5hOnNlY3JldG8=');
    assert.strictEqual(authRequest(schemes, { Basic: { username: 'ñu', password: '' } }).headers.Authorization, `Basic ${Buffer.from('ñu:').toString('base64')}`);
  });

  it('should send nothing without credentials and list the schemes that have them', function () {
    // ASSERT
    assert.deepStrictEqual(authRequest(schemes, {}), { headers: {}, query: {} });
    assert.deepStrictEqual(authRequest(undefined, undefined), { headers: {}, query: {} });
    assert.deepStrictEqual(authorizedSchemes(schemes, { 'Bearer token': { token: 'x' }, Basic: { username: '' } }), ['Bearer token']);
  });

  it('should move a sample url to another environment, keeping the rest of the path', function () {
    // ASSERT
    assert.strictEqual(inEnvironment('https://apidoc.free.beeceptor.com/user/1?a=b', 'https://sandbox.example.com/', 'https://apidoc.free.beeceptor.com'), 'https://sandbox.example.com/user/1?a=b');
    assert.strictEqual(inEnvironment('https://x.dev/v1/user', 'https://api.example.com/v2', 'https://x.dev/v1'), 'https://api.example.com/v2/user');
    assert.strictEqual(inEnvironment('https://other.dev/user', 'https://api.example.com'), 'https://api.example.com/user');
    assert.strictEqual(inEnvironment('/relative/path', 'https://api.example.com'), '/relative/path');
  });

  it('should add query parameters to a url', function () {
    // ASSERT
    assert.strictEqual(withQuery('https://a.dev/x', { k: 'a b' }), 'https://a.dev/x?k=a%20b');
    assert.strictEqual(withQuery('https://a.dev/x?y=1', { k: 'v' }), 'https://a.dev/x?y=1&k=v');
    assert.strictEqual(withQuery('https://a.dev/x', {}), 'https://a.dev/x');
  });
});
