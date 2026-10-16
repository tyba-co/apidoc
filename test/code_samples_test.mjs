import assert from 'assert';

import { codeSamples, pythonLiteral, requestModel } from '../template/src/code_samples.mjs';

const bearer = { auth: [{ name: 'Token', type: 'bearer' }] };
const lookup = {
  type: 'get',
  url: 'https://api.example.com/users/:id',
  parameter: { fields: { Parameter: [{ field: 'id', type: 'Number', defaultValue: '7' }] } },
  query: [
    { field: 'limit', type: 'Number', optional: true, defaultValue: '20' },
    { field: 'q', type: 'String' },
    { field: 'skip', type: 'Number', optional: true },
  ],
  header: { fields: { Header: [{ field: 'X-Trace', type: 'String', defaultValue: 'abc' }] } },
  permission: [{ name: 'user' }],
};
const create = {
  type: 'post',
  url: 'https://api.example.com/users',
  body: [
    { field: 'age', type: 'Number' },
    { field: 'name', type: 'String', defaultValue: "O'Hara" },
    { field: 'active', type: 'Boolean', defaultValue: 'true' },
  ],
};
const bySample = (article, project) => Object.fromEntries(codeSamples(article, project).map(sample => [sample.key, sample.code]));

describe('code samples', function () {
  before(function () {
    globalThis.window = { navigator: { language: 'en-US' } };
  });

  after(function () {
    delete globalThis.window;
  });

  it('should fill the path, the required query and the headers, and add the credentials', function () {
    // ACT
    const model = requestModel(lookup, bearer);
    const samples = bySample(lookup, bearer);

    // ASSERT
    assert.strictEqual(model.url, 'https://api.example.com/users/7');
    assert.deepStrictEqual(model.query, [['limit', '20'], ['q', 'text']]);
    assert.strictEqual(samples.curl, [
      'curl -X GET "https://api.example.com/users/7?limit=20&q=text"',
      '  -H "X-Trace: abc"',
      '  -H "Authorization: Bearer <token>"',
    ].join(' \\\n'));
    assert.ok(samples.javascript.includes("const response = await fetch('https://api.example.com/users/7?limit=20&q=text', {"));
    assert.ok(samples.javascript.includes("    'Authorization': 'Bearer <token>',"));
    assert.ok(samples.python.includes("response = requests.get(\n    'https://api.example.com/users/7',\n    params={\n        'limit': '20',\n        'q': 'text',\n    },"));
  });

  it('should send no credentials to a public endpoint, and an api key in the query when asked', function () {
    // ARRANGE
    const publicEndpoint = Object.assign({}, lookup, { permission: [{ name: 'none' }] });
    const queryKey = { auth: [{ name: 'Key', type: 'apiKey', in: 'query', param: 'api_key' }] };

    // ASSERT
    assert.ok(!bySample(publicEndpoint, bearer).curl.includes('Authorization'));
    assert.ok(bySample(lookup, queryKey).curl.includes('api_key=%3Ckey%3E'));
  });

  it('should write a json body in the three languages', function () {
    // ACT
    const samples = bySample(create);

    // ASSERT
    assert.ok(samples.curl.includes('-H "Content-Type: application/json"'));
    assert.ok(samples.curl.endsWith(`-d '{"age":0,"name":"O'\\''Hara","active":true}'`));
    assert.ok(samples.javascript.includes("    'Content-Type': 'application/json',"));
    assert.ok(samples.javascript.includes('  body: JSON.stringify({\n    "age": 0,'));
    assert.ok(!samples.python.includes('Content-Type'));
    assert.ok(samples.python.includes("    json={\n        'age': 0,\n        'name': 'O\\'Hara',\n        'active': True,\n    },"));
  });

  it('should write multipart with the file and the plain parts', function () {
    // ARRANGE
    const upload = { type: 'post', url: 'https://api.example.com/import', body: [{ field: 'users', type: 'File', allowedValues: ['"csv"'] }, { field: 'dryRun', type: 'Boolean' }] };

    // ACT
    const samples = bySample(upload);

    // ASSERT
    assert.ok(samples.curl.includes('  -F "users=@users.csv;type=text/csv"'));
    assert.ok(samples.curl.includes('  -F "dryRun=true"'));
    assert.ok(!samples.curl.includes('Content-Type'));
    assert.ok(samples.javascript.includes("form.append('users', fileInput.files[0]); // users.csv"));
    assert.ok(samples.javascript.includes('  body: form,'));
    assert.ok(!samples.javascript.includes("'Content-Type'"));
    assert.ok(samples.python.includes("files={'users': ('users.csv', open('users.csv', 'rb'), 'text/csv')},"));
    assert.ok(samples.python.includes("data={\n        'dryRun': 'true',\n    },"));
  });

  it('should write urlencoded, binary and text bodies', function () {
    // ARRANGE
    const form = { type: 'post', url: 'https://api.example.com/token', contentType: 'application/x-www-form-urlencoded', body: [{ field: 'grant', type: 'String', defaultValue: 'password' }] };
    const avatar = { type: 'put', url: 'https://api.example.com/avatar', contentType: 'image/png', body: [{ field: 'avatar', type: 'File', allowedValues: ['"png"'] }] };
    const xml = { type: 'post', url: 'https://api.example.com/order', contentType: 'application/xml', body: [{ field: 'id', type: 'Number' }], parameter: { examples: [{ content: '<order/>' }] } };

    // ASSERT
    assert.ok(bySample(form).curl.includes('--data-urlencode "grant=password"'));
    assert.ok(bySample(form).javascript.includes("body: new URLSearchParams([['grant', 'password']]),"));
    assert.ok(bySample(avatar).curl.includes('-H "Content-Type: image/png"'));
    assert.ok(bySample(avatar).curl.includes('--data-binary @avatar.png'));
    assert.ok(bySample(avatar).python.includes("data=open('avatar.png', 'rb'),"));
    assert.ok(bySample(xml).curl.includes("-d '<order/>'"));
    assert.ok(bySample(xml).python.includes("data='<order/>',"));
  });

  it('should not add a body to an endpoint without one, and write python literals', function () {
    // ASSERT
    assert.ok(!bySample(lookup).curl.includes(' -d '));
    assert.strictEqual(pythonLiteral({ a: [1, null, false], b: {} }), "{\n    'a': [\n        1,\n        None,\n        False,\n    ],\n    'b': {},\n}");
  });

  it('should put a placeholder in a secret header that has no example', function () {
    // ARRANGE
    const article = { type: 'get', url: 'https://a.dev/x', header: { fields: { Header: [{ field: 'Authorization', type: 'String' }, { field: 'X-Api-Key', type: 'String' }, { field: 'X-Trace', type: 'String', defaultValue: 'abc' }] } } };

    // ACT
    const { curl } = bySample(article);

    // ASSERT
    assert.ok(curl.includes('-H "Authorization: <token>"'));
    assert.ok(curl.includes('-H "X-Api-Key: <key>"'));
    assert.ok(curl.includes('-H "X-Trace: abc"'));
  });
});
