/**
 * Test: OpenAPI export (--openapi)
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { bodyKind, toOpenApi } = require('../lib/openapi');

const project = { name: 'Acme', version: '2.0.0', description: 'The Acme API', url: 'https://api.example.com' };
const user = {
  type: 'post',
  url: '/users/:id',
  version: '1.0.0',
  name: 'CreateUser',
  group: 'User',
  title: 'Create a user',
  description: '<p>Creates <b>a</b> user.</p>',
  parameter: { fields: { Parameter: [{ field: 'id', type: 'Number', optional: false, description: '<p>User id.</p>' }] } },
  query: [{ field: 'dry', type: 'Boolean', optional: true, defaultValue: 'false' }],
  header: { fields: { Header: [{ field: 'X-Trace', type: 'String', optional: true }, { field: 'Authorization', type: 'String' }] } },
  body: [
    { field: 'name', type: 'String', size: '1..64', optional: false },
    { field: 'role', type: 'String', allowedValues: ['"ADMIN"', '"USER"'], optional: true, defaultValue: 'USER' },
    { field: 'extra', type: 'Object', optional: false },
    { field: 'extra.tags', type: 'String[]', optional: true, parentNode: { path: 'extra', field: 'extra', type: 'Object' } },
    { field: 'extra.note', type: 'String', optional: false, parentNode: { path: 'extra', field: 'extra', type: 'Object' } },
  ],
  success: { fields: { 'Success 200': [{ field: 'id', type: 'Number', optional: false }], '201 Created': [{ field: 'id', type: 'Number', optional: false }] }, examples: [{ title: 'ok', type: 'json', content: 'HTTP/1.1 200 OK\n{"id":1}' }] },
  error: { fields: { 'Error 4xx': [{ field: 'NotFound', description: '<p>No such user.</p>' }], '500 Internal Server Error': [{ field: 'Boom', description: '<p>Unexpected.</p>' }] } },
  responseHeader: { fields: { 'Response Headers': [{ field: 'X-Rate-Remaining', type: 'Number', optional: false, description: '<p>Calls left.</p>' }] } },
  permission: [{ name: 'admin' }],
};

describe('OpenAPI export', function () {
  it('should describe the document, the servers and the security schemes', function () {
    // ACT
    const document = toOpenApi([user], Object.assign({}, project, {
      environments: [{ name: 'Sandbox', url: 'https://sandbox.example.com' }],
      auth: [{ name: 'Bearer token', type: 'bearer' }, { name: 'Key', type: 'apiKey', in: 'query', param: 'k' }, { name: 'Basic', type: 'basic' }, { name: 'Custom', type: 'bearer', prefix: 'Token' }],
    }));

    // ASSERT
    assert.strictEqual(document.openapi, '3.0.3');
    assert.deepStrictEqual(document.info, { title: 'Acme', version: '2.0.0', description: 'The Acme API' });
    assert.deepStrictEqual(document.servers, [{ url: 'https://sandbox.example.com', description: 'Sandbox' }]);
    assert.deepStrictEqual(document.components.securitySchemes.Bearer_token, { type: 'http', scheme: 'bearer' });
    assert.deepStrictEqual(document.components.securitySchemes.Key, { type: 'apiKey', in: 'query', name: 'k' });
    assert.deepStrictEqual(document.components.securitySchemes.Basic, { type: 'http', scheme: 'basic' });
    assert.strictEqual(document.components.securitySchemes.Custom.type, 'apiKey');
    assert.deepStrictEqual(document.security.map(entry => Object.keys(entry)[0]), ['Bearer_token', 'Key', 'Basic', 'Custom']);
    assert.deepStrictEqual(toOpenApi([user], project).servers, [{ url: 'https://api.example.com' }]);
  });

  it('should turn an endpoint into an operation with its parameters', function () {
    // ACT
    const operation = toOpenApi([user], project).paths['/users/{id}'].post;

    // ASSERT
    assert.deepStrictEqual(operation.tags, ['User']);
    assert.strictEqual(operation.summary, 'Create a user');
    assert.strictEqual(operation.operationId, 'CreateUser');
    assert.strictEqual(operation.description, 'Creates a user.');
    assert.deepStrictEqual(operation['x-permissions'], ['admin']);
    assert.deepStrictEqual(operation.parameters, [
      { name: 'id', in: 'path', required: true, schema: { type: 'number' }, description: 'User id.' },
      { name: 'dry', in: 'query', required: false, schema: { type: 'boolean', default: false } },
      { name: 'X-Trace', in: 'header', required: false, schema: { type: 'string' } },
    ]);
  });

  it('should build the json body with nesting, required fields, sizes and allowed values', function () {
    // ACT
    const body = toOpenApi([user], project).paths['/users/{id}'].post.requestBody;
    const schema = body.content['application/json'].schema;

    // ASSERT
    assert.strictEqual(body.required, true);
    assert.deepStrictEqual(schema.required, ['name', 'extra']);
    assert.deepStrictEqual(schema.properties.name, { type: 'string', minLength: 1, maxLength: 64 });
    assert.deepStrictEqual(schema.properties.role, { type: 'string', enum: ['ADMIN', 'USER'], default: 'USER' });
    assert.deepStrictEqual(schema.properties.extra.properties.tags, { type: 'array', items: { type: 'string' } });
    assert.deepStrictEqual(schema.properties.extra.required, ['note']);
  });

  it('should map success and error groups to statuses, with the example and the response headers', function () {
    // ACT
    const result = toOpenApi([user], project).paths['/users/{id}'].post.responses;

    // ASSERT
    assert.deepStrictEqual(Object.keys(result).sort(), ['200', '201', '4XX', '500']);
    assert.deepStrictEqual(result['200'].content['application/json'].example, { id: 1 });
    assert.strictEqual(result['200'].headers['X-Rate-Remaining'].description, 'Calls left.');
    assert.strictEqual(result['4XX'].description, 'Error 4xx. NotFound: No such user.');
    assert.strictEqual(result['4XX'].content, undefined);
  });

  it('should describe multipart files with their columns, urlencoded, binary and text bodies', function () {
    // ARRANGE
    const make = (name, extra) => Object.assign({ type: 'post', url: `/${name}`, version: '1.0.0', name, group: 'G', title: name }, extra);
    const upload = make('upload', {
      body: [{ field: 'users', type: 'File', allowedValues: ['"csv"'], optional: false }, { field: 'dry', type: 'Boolean', optional: true }],
      fileColumns: [{ group: 'users', type: 'String', field: 'name' }, { group: 'users', type: 'Number', field: 'age', optional: true }],
    });
    const form = make('form', { contentType: 'application/x-www-form-urlencoded', body: [{ field: 'grant', type: 'String', optional: false }] });
    const avatar = make('avatar', { contentType: 'image/png', body: [{ field: 'avatar', type: 'File', optional: false }] });
    const xml = make('xml', { contentType: 'application/xml', body: [{ field: 'id', type: 'Number', optional: false }], parameter: { examples: [{ content: '<a/>' }] } });

    // ACT
    const paths = toOpenApi([upload, form, avatar, xml], project).paths;

    // ASSERT
    const multipart = paths['/upload'].post.requestBody.content['multipart/form-data'].schema;
    assert.deepStrictEqual(multipart.properties.users, { type: 'string', format: 'binary', description: 'Columns, in order: name (String), age (Number, optional).' });
    assert.ok(paths['/form'].post.requestBody.content['application/x-www-form-urlencoded'].schema.properties.grant);
    assert.deepStrictEqual(paths['/avatar'].post.requestBody.content['image/png'].schema, { type: 'string', format: 'binary' });
    assert.deepStrictEqual(paths['/xml'].post.requestBody.content['application/xml'].schema, { type: 'string', example: '<a/>' });
  });

  it('should describe a file the endpoint returns', function () {
    // ARRANGE
    const download = { type: 'get', url: '/export', version: '1.0.0', name: 'Export', group: 'G', title: 'Export', success: { fields: { 'Success 200': [{ field: 'users', type: 'File', allowedValues: ['"csv"'] }] } }, fileColumns: [{ group: 'users', type: 'String', field: 'name' }] };

    // ACT
    const response = toOpenApi([download], project).paths['/export'].get.responses['200'];

    // ASSERT
    assert.deepStrictEqual(response.content, { 'text/csv': { schema: { type: 'string', format: 'binary' } } });
    assert.ok(response.description.includes('Columns, in order: name (String).'));
  });

  it('should keep webhooks apart, mark streams, open public endpoints and keep the newest version', function () {
    // ARRANGE
    const make = (name, version, extra) => Object.assign({ type: 'get', url: '/x', version, name, group: 'G', title: name }, extra);
    const data = [
      make('Old', '1.0.0'),
      make('New', '1.2.0'),
      make('Hook', '1.0.0', { type: 'POST', url: '/hook', webhook: true }),
      make('Feed', '1.0.0', { url: '/feed', streaming: { type: 'sse', description: '' }, success: { fields: { 'Success 200': [{ field: 'event', type: 'String' }] } } }),
      make('Open', '1.0.0', { url: '/open', permission: [{ name: 'none' }] }),
    ];

    // ACT
    const document = toOpenApi(data, Object.assign({}, project, { auth: [{ name: 'T', type: 'bearer' }] }));

    // ASSERT
    assert.strictEqual(document.paths['/x'].get.operationId, 'New');
    assert.strictEqual(document.paths['/hook'], undefined);
    assert.ok(document['x-webhooks'].Hook.post);
    assert.ok(document.paths['/feed'].get.responses['200'].content['text/event-stream']);
    assert.deepStrictEqual(document.paths['/feed'].get['x-streaming'], { type: 'sse', description: '' });
    assert.deepStrictEqual(document.paths['/open'].get.security, []);
  });

  it('should classify bodies like the template does', async function () {
    // ARRANGE
    const { bodyKind: templateKind } = await import('../template/src/body_kind.mjs');
    const mimes = [undefined, 'application/json', 'application/vnd.api+json', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml', 'application/soap+xml', 'text/plain', 'text/csv', 'application/octet-stream', 'image/png'];
    const bodies = [[{ field: 'a', type: 'String' }], [{ field: 'f', type: 'File' }]];

    // ACT
    const different = [];
    mimes.forEach(contentType => bodies.forEach(body => {
      const article = { contentType, body };
      if (bodyKind(article) !== templateKind(article)) { different.push(`${contentType} ${body[0].type}`); }
    }));

    // ASSERT
    assert.deepStrictEqual(different, []);
  });

  it('should write a consistent openapi.json for the example project with --openapi', function () {
    // ARRANGE
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-openapi-'));

    try {
      // ACT
      const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'apidoc'), '-i', path.join(__dirname, '..', 'example'), '-o', output, '--openapi', '-q'], { encoding: 'utf8' });
      const document = JSON.parse(fs.readFileSync(path.join(output, 'openapi.json'), 'utf8'));
      const operations = Object.entries(document.paths).flatMap(([route, item]) => Object.entries(item).map(([method, operation]) => ({ route, method, operation })));
      const ids = operations.map(entry => entry.operation.operationId);

      // ASSERT
      assert.strictEqual(run.status, 0);
      assert.strictEqual(document.openapi, '3.0.3');
      assert.ok(operations.length > 20);
      assert.strictEqual(new Set(ids).size, ids.length);
      operations.forEach(({ route, method, operation }) => {
        assert.ok(route.startsWith('/'), route);
        assert.ok(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'].includes(method), `${route} ${method}`);
        assert.ok(Object.keys(operation.responses).length > 0, `${route} has no responses`);
        const declared = (operation.parameters || []).filter(param => param.in === 'path').map(param => param.name);
        assert.deepStrictEqual((route.match(/\{(\w+)\}/g) || []).map(token => token.slice(1, -1)).sort(), declared.sort(), route);
      });
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  }).timeout(60000);
});
