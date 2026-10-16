import assert from 'assert';

import { buildParts, multipartExample } from '../template/src/multipart_example.mjs';

const article = {
  type: 'post',
  url: 'https://api.example.com/user/import?dry=1',
  body: [
    { field: 'users', type: 'File', allowedValues: ['"csv"'] },
    { field: 'dryRun', type: 'Boolean', defaultValue: 'false' },
    { field: 'extraInfo', type: 'Object' },
    { field: 'extraInfo.note', type: 'String', defaultValue: 'hi', parentNode: { path: 'extraInfo', field: 'extraInfo', type: 'Object' } },
  ],
  fileColumns: [
    { group: 'users', type: 'String', field: 'name' },
    { group: 'users', type: 'Number', field: 'age' },
  ],
};

describe('multipart example', function () {
  it('should make one part per file and per scalar field, named like the sample request form', function () {
    // ACT
    const parts = buildParts(article.body, [{ name: 'users', text: 'name,age\ntext,0' }]);

    // ASSERT
    assert.deepStrictEqual(parts.map(part => part.name), ['users', 'dryRun', 'extraInfo[note]']);
    assert.strictEqual(parts[0].filename, 'users.csv');
    assert.strictEqual(parts[0].contentType, 'text/csv');
    assert.strictEqual(parts[0].content, 'name,age\ntext,0');
    assert.strictEqual(parts[2].content, 'hi');
  });

  it('should write the raw request with the csv content of the file', function () {
    // ACT
    const { raw } = multipartExample(article);

    // ASSERT
    assert.ok(raw.startsWith('POST /user/import?dry=1 HTTP/1.1\nHost: api.example.com\nContent-Type: multipart/form-data; boundary=----apidoc-boundary\n'));
    assert.ok(raw.includes('Content-Disposition: form-data; name="users"; filename="users.csv"\nContent-Type: text/csv\n\nname,age\ntext,0\n'));
    assert.ok(raw.includes('Content-Disposition: form-data; name="dryRun"\n\nfalse\n'));
    assert.ok(raw.endsWith('------apidoc-boundary--'));
  });

  it('should write a curl command that references the file and sends the other fields', function () {
    // ACT
    const { curl } = multipartExample(article);

    // ASSERT
    assert.strictEqual(curl, [
      'curl -X POST "https://api.example.com/user/import?dry=1"',
      '  -F "users=@users.csv;type=text/csv"',
      '  -F "dryRun=false"',
      '  -F "extraInfo[note]=hi"',
    ].join(' \\\n'));
  });

  it('should send two parts under the same name for File[] and mark binary formats', function () {
    // ARRANGE
    const several = { type: 'put', url: '/files', body: [{ field: 'sheets', type: 'File[]', allowedValues: ['"xlsx"'] }] };

    // ACT
    const parts = buildParts(several.body, []);
    const { raw } = multipartExample(several);

    // ASSERT
    assert.deepStrictEqual(parts.map(part => part.filename), ['sheets1.xlsx', 'sheets2.xlsx']);
    assert.ok(parts.every(part => part.name === 'sheets'));
    assert.ok(parts[0].contentType.includes('spreadsheetml'));
    assert.strictEqual(parts[0].content, '[file content]');
    assert.ok(raw.startsWith('PUT /files HTTP/1.1\nContent-Type: multipart/form-data'));
  });
});
