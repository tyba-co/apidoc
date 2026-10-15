/**
 * Test: parsers of the request types (@apiContentType, @apiResponseHeader, @apiWebhook, @apiStreaming)
 */
const assert = require('assert');

const contentType = require('../../../lib/core/parsers/api_content_type');
const responseHeader = require('../../../lib/core/parsers/api_response_header');
const streaming = require('../../../lib/core/parsers/api_streaming');
const webhook = require('../../../lib/core/parsers/api_webhook');

describe('Parser: request types', function () {
  it('should lower-case a valid content type and reject anything else', function () {
    // ASSERT
    assert.deepStrictEqual(contentType.parse(' Application/X-WWW-Form-Urlencoded '), { contentType: 'application/x-www-form-urlencoded' });
    assert.deepStrictEqual(contentType.parse('application/vnd.api+json'), { contentType: 'application/vnd.api+json' });
    assert.strictEqual(contentType.parse('  '), null);
    assert.throws(() => contentType.parse('json'), /Content type not valid/);
    assert.throws(() => contentType.parse('application/json; charset=utf-8'), /Content type not valid/);
  });

  it('should parse a response header like a request header, in its own group', function () {
    // ACT
    const parsed = responseHeader.parse('{String} Location="/jobs/1" URL to poll.');

    // ASSERT
    assert.strictEqual(parsed.field, 'Location');
    assert.strictEqual(parsed.type, 'String');
    assert.strictEqual(parsed.defaultValue, '/jobs/1');
    assert.strictEqual(parsed.group, 'Response Headers');
    assert.strictEqual(responseHeader.path(), 'local.responseHeader.fields.Response Headers');
    assert.strictEqual(responseHeader.parse('(Response Headers 202) {Number} Retry-After=5 Seconds.').group, 'Response Headers 202');
  });

  it('should mark a webhook, with an optional explanation', function () {
    // ASSERT
    assert.deepStrictEqual(webhook.parse(''), { webhook: true });
    assert.deepStrictEqual(webhook.parse(' Sent when a user is created. '), { webhook: 'Sent when a user is created.' });
  });

  it('should read the type and the description of a stream', function () {
    // ASSERT
    assert.deepStrictEqual(streaming.parse('{sse} One event per change.'), { streaming: { type: 'sse', description: 'One event per change.' } });
    assert.deepStrictEqual(streaming.parse('{ndjson}'), { streaming: { type: 'ndjson', description: '' } });
    assert.deepStrictEqual(streaming.parse('Keeps the connection open.'), { streaming: { type: 'stream', description: 'Keeps the connection open.' } });
  });
});
