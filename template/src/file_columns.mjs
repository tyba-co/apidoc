/**
 * Presentation of the File fields of a body and of the columns declared for them with @apiFileColumn.
 */
import { unquoteField } from './field_path.mjs';

const UNSPECIFIED_FILE = 'Columns';
const DELIMITERS = { csv: ',', tsv: '\t' };
const SAMPLES_BY_TYPE = { string: 'text', number: '0', boolean: 'true', date: '2026-01-31', datetime: '2026-01-31T10:00:00Z', email: 'ana@example.com' };

const stripQuotes = value => value.replace(/^["']|["']$/g, '');

/**
 * @param {String} [type]
 * @returns {Boolean} whether the type is File or File[]
 */
export const isFileType = type => typeof type === 'string' && type.replace('[]', '').toLowerCase() === 'file';

/**
 * @param {Object[]} bodyFields
 * @returns {Boolean} whether at least one field can be part of a JSON body
 */
export const hasJsonFields = bodyFields => (bodyFields || []).some(field => !isFileType(field.type));

/**
 * @param {Number} index zero based
 * @returns {String} spreadsheet column name: A, B, ... Z, AA
 */
export function columnLetter (index) {
  let name = '';
  for (let rest = index; rest >= 0; rest = Math.floor(rest / 26) - 1) {
    const offset = rest % 26;
    name = String.fromCharCode(65 + offset) + name;
  }
  return name;
}

/**
 * @param {String[][]} rows header first
 * @param {String} delimiter
 * @returns {String} text with the fields quoted when they hold the delimiter, a quote or a line break
 */
export function delimitedText (rows, delimiter) {
  const needsQuotes = value => /["\n\r]/.test(value) || value.includes(delimiter);
  const quote = value => {
    if (!needsQuotes(value)) { return value; }
    return `"${value.replace(/"/g, '""')}"`;
  };
  return rows.map(row => row.map(quote).join(delimiter)).join('\n');
}

/**
 * @param {Object} column
 * @returns {String} the value shown for the column in the example row
 */
function exampleValue (column) {
  if (column.defaultValue !== undefined && column.defaultValue !== '') { return String(column.defaultValue); }
  if (column.allowedValues && column.allowedValues.length > 0) { return stripQuotes(column.allowedValues[0]); }
  return SAMPLES_BY_TYPE[(column.type || '').toLowerCase()] || '';
}

/**
 * @param {Object} column
 * @param {Number} index
 * @returns {Object}
 */
function describeColumn (column, index) {
  return {
    position: index + 1,
    letter: columnLetter(index),
    name: unquoteField(column.field),
    type: column.type,
    optional: Boolean(column.optional),
    description: column.description,
    size: column.size,
    allowedValues: (column.allowedValues || []).map(stripQuotes),
    example: exampleValue(column),
  };
}

/**
 * @param {String} name
 * @param {Object} [field] the File field of the body, when there is one
 * @param {Object[]} columns
 * @returns {Object}
 */
function buildSpec (name, field, columns) {
  const allowed = field && field.allowedValues ? field.allowedValues : [];
  const formats = allowed.map(value => stripQuotes(value).toLowerCase());
  const described = columns.map(describeColumn);
  const delimiter = DELIMITERS[formats[0]];
  const header = described.map(column => column.name);
  const row = described.map(column => column.example);
  return {
    name,
    formats,
    formatLabel: formats.map(format => format.toUpperCase()).join(' / '),
    size: field && field.size,
    optional: Boolean(field && field.optional),
    multiple: Boolean(field && field.type.includes('[]')),
    description: field && field.description,
    columns: described,
    letters: described.map(column => column.letter),
    header,
    rows: [row],
    text: delimiter === undefined ? undefined : delimitedText([header, row], delimiter),
  };
}

/**
 * One entry per File field that has columns, in body order, plus one for every group of columns
 * that matches no File field. Columns written without a (file) belong to the first File field.
 *
 * @param {Object[]} [bodyFields] @apiBody entries
 * @param {Object[]} [columns] @apiFileColumn entries
 * @returns {Object[]}
 */
export function describeFiles (bodyFields, columns) {
  const files = (bodyFields || []).filter(field => isFileType(field.type));
  const allColumns = columns || [];
  const assigned = new Set();

  const specs = [];
  files.forEach((file, index) => {
    const name = unquoteField(file.field);
    const belongs = column => {
      if (column.group === name) { return true; }
      return index === 0 && column.group === UNSPECIFIED_FILE;
    };
    const mine = allColumns.filter(belongs);
    if (mine.length === 0) { return; }
    mine.forEach(column => assigned.add(column));
    specs.push(buildSpec(name, file, mine));
  });

  const orphans = allColumns.filter(column => !assigned.has(column));
  [...new Set(orphans.map(column => column.group))].forEach(group => {
    specs.push(buildSpec(group, undefined, orphans.filter(column => column.group === group)));
  });
  return specs;
}
