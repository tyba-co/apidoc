import assert from 'assert';

import { requestExample } from '../template/src/request_examples.mjs';

const token = {
  type: 'post',
  url: 'https://api.example.com/oauth/token',
  contentType: 'application/x-www-form-urlencoded',
  body: [
    { field: 'grant_type', type: 'String', allowedValues: ['"password"', '"refresh_token"'] },
    { field: 'username', type: 'String', defaultValue: 'ana@example.com' },
    { field: 'scope', type: 'String[]', defaultValue: 'read write' },
  ],
};

describe('request examples', function () {
  it('should write the urlencoded request with encoded values and a curl with --data-urlencode', function () {
    // ACT
    const [raw, curl] = requestExample(token);

    // ASSERT
    assert.strictEqual(raw.title, 'Request');
    assert.strictEqual(raw.language, 'http');
    assert.ok(raw.code.startsWith('POST /oauth/token HTTP/1.1\nHost: api.example.com\nContent-Type: application/x-www-form-urlencoded\n\n'));
    assert.ok(raw.code.endsWith('grant_type=password&username=ana%40example.com&scope=read%20write'));
    assert.strictEqual(curl.code, [
      'curl -X POST "https://api.example.com/oauth/token"',
      '  --data-urlencode "grant_type=password"',
      '  --data-urlencode "username=ana@example.com"',
      '  --data-urlencode "scope=read write"',
    ].join(' \\\n'));
  });

  it('should write a binary body with the declared mime and a file named after the field', function () {
    // ARRANGE
    const avatar = { type: 'put', url: 'https://api.example.com/users/1/avatar', contentType: 'image/png', body: [{ field: 'avatar', type: 'File', allowedValues: ['"png"'] }] };

    // ACT
    const [raw, curl] = requestExample(avatar);

    // ASSERT
    assert.ok(raw.code.startsWith('PUT /users/1/avatar HTTP/1.1\nHost: api.example.com\nContent-Type: image/png\n\n[binary content]'));
    assert.strictEqual(curl.code, 'curl -X PUT "https://api.example.com/users/1/avatar" \\\n  -H "Content-Type: image/png" \\\n  --data-binary @avatar.png');
  });

  it('should keep the multipart example for bodies with files', function () {
    // ARRANGE
    const upload = { type: 'post', url: '/files', body: [{ field: 'doc', type: 'File', allowedValues: ['"pdf"'] }] };

    // ACT
    const [raw] = requestExample(upload);

    // ASSERT
    assert.strictEqual(raw.title, 'Multipart');
    assert.ok(raw.code.includes('filename="doc.pdf"'));
  });

  it('should give no generated example for json, xml and text bodies, or without a body', function () {
    // ASSERT
    assert.strictEqual(requestExample({ type: 'post', url: '/a', body: [{ field: 'a', type: 'String' }] }), undefined);
    assert.strictEqual(requestExample({ type: 'post', url: '/a', contentType: 'application/xml', body: [{ field: 'a', type: 'String' }] }), undefined);
    assert.strictEqual(requestExample({ type: 'post', url: '/a', contentType: 'text/plain' }), undefined);
    assert.strictEqual(requestExample({ type: 'post', url: '/a', contentType: 'application/x-www-form-urlencoded' }), undefined);
  });
});
