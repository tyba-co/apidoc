import assert from 'assert';

import { columnLetter, delimitedText, describeFiles, hasJsonFields, isFileType } from '../template/src/file_columns.mjs';

const body = [
  { field: 'sales', type: 'File', allowedValues: ['"csv"'], size: '5MB', description: '<p>Monthly export.</p>' },
  { field: 'note', type: 'String', optional: true },
];
const columns = [
  { group: 'sales', type: 'Date', field: 'date', description: '<p>Sale date.</p>' },
  { group: 'sales', type: 'Number', field: 'amount', defaultValue: '1500' },
  { group: 'sales', type: 'String', field: '"Customer name"' },
  { group: 'sales', type: 'String', field: 'status', optional: true, allowedValues: ['"ACTIVE"', '"BLOCKED"'] },
];

describe('file columns', function () {
  it('should recognize File and File[] as file types only', function () {
    // ASSERT
    assert.ok(isFileType('File'));
    assert.ok(isFileType('file[]'));
    assert.ok(!isFileType('Filename'));
    assert.ok(!isFileType(undefined));
  });

  it('should tell whether a body has fields that can go in JSON', function () {
    // ASSERT
    assert.ok(hasJsonFields(body));
    assert.ok(!hasJsonFields([body[0]]));
    assert.ok(!hasJsonFields(undefined));
  });

  it('should name columns like a spreadsheet', function () {
    // ASSERT
    assert.deepStrictEqual([0, 1, 25, 26, 27, 701, 702].map(columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('should quote fields only when needed', function () {
    // ACT
    const text = delimitedText([['a', 'b'], ['x,y', 'say "hi"'], ['line\nbreak', 'plain']], ',');

    // ASSERT
    assert.strictEqual(text, 'a,b\n"x,y","say ""hi"""\n"line\nbreak",plain');
  });

  it('should describe the columns of a file with example values, formats and the csv text', function () {
    // ACT
    const [spec] = describeFiles(body, columns);

    // ASSERT
    assert.strictEqual(spec.name, 'sales');
    assert.deepStrictEqual(spec.formats, ['csv']);
    assert.strictEqual(spec.formatLabel, 'CSV');
    assert.strictEqual(spec.size, '5MB');
    assert.deepStrictEqual(spec.header, ['date', 'amount', 'Customer name', 'status']);
    assert.deepStrictEqual(spec.rows, [['2026-01-31', '1500', 'text', 'ACTIVE']]);
    assert.deepStrictEqual(spec.letters, ['A', 'B', 'C', 'D']);
    assert.strictEqual(spec.text, 'date,amount,Customer name,status\n2026-01-31,1500,text,ACTIVE');
    assert.deepStrictEqual(spec.columns.map(column => column.position), [1, 2, 3, 4]);
    assert.ok(spec.columns[3].optional);
    assert.deepStrictEqual(spec.columns[3].allowedValues, ['ACTIVE', 'BLOCKED']);
  });

  it('should use tabs for tsv and no raw text for other formats', function () {
    // ARRANGE
    const tsv = [{ field: 'f', type: 'File', allowedValues: ['"tsv"'] }];
    const xlsx = [{ field: 'f', type: 'File', allowedValues: ['"xlsx"'] }];
    const one = [{ group: 'f', type: 'String', field: 'a' }, { group: 'f', type: 'String', field: 'b' }];

    // ACT
    const [tabbed] = describeFiles(tsv, one);
    const [sheet] = describeFiles(xlsx, one);

    // ASSERT
    assert.strictEqual(tabbed.text, 'a\tb\ntext\ttext');
    assert.strictEqual(sheet.text, undefined);
    assert.strictEqual(sheet.formatLabel, 'XLSX');
  });

  it('should attach columns without a file to the first file, and list unmatched groups on their own', function () {
    // ARRANGE
    const twoFiles = [{ field: 'first', type: 'File' }, { field: 'second', type: 'File' }];
    const mixed = [
      { group: 'Columns', type: 'String', field: 'loose' },
      { group: 'second', type: 'Number', field: 'n' },
      { group: 'ghost', type: 'Date', field: 'd' },
    ];

    // ACT
    const specs = describeFiles(twoFiles, mixed);

    // ASSERT
    assert.deepStrictEqual(specs.map(spec => spec.name), ['first', 'second', 'ghost']);
    assert.deepStrictEqual(specs[0].header, ['loose']);
    assert.strictEqual(specs[2].formats.length, 0);
  });

  it('should describe nothing when there are no columns', function () {
    // ASSERT
    assert.deepStrictEqual(describeFiles(body, []), []);
    assert.deepStrictEqual(describeFiles(undefined, undefined), []);
  });
});
