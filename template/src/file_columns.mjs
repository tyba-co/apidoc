/**
 * Presentation of the File fields of a body and of the columns declared for them with @apiFileColumn.
 */
import { unquoteField } from './field_path.mjs';

const UNSPECIFIED_FILE = 'Columns';
const DELIMITERS = { csv: ',', tsv: '\t' };
const SAMPLES_BY_TYPE = { string: 'text', number: '0', boolean: 'true', date: '2026-01-31', datetime: '2026-01-31T10:00:00Z', email: 'ana@example.com' };

const CONTENT_TYPES = {
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  zip: 'application/zip',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const stripQuotes = value => value.replace(/^["']|["']$/g, '');

/**
 * @param {String} format file extension, such as csv
 * @returns {String} its media type
 */
export const contentTypeOfFormat = format => CONTENT_TYPES[format] || 'application/octet-stream';

/**
 * @param {String} [type]
 * @returns {Boolean} whether the type is File or File[]
 */
export const isFileType = type => typeof type === 'string' && type.replace('[]', '').toLowerCase() === 'file';

/**
 * @param {Object[]} [bodyFields]
 * @returns {Boolean} whether the body has a File field, which makes the request multipart/form-data
 */
export const hasFiles = bodyFields => (bodyFields || []).some(field => isFileType(field.type));

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
 * @param {Object} column a column or a body field
 * @returns {String} the default, else the first allowed value, else a placeholder by type
 */
export function exampleValue (column) {
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
 * @param {String} format
 * @param {String} [text] the content of the file, when it is text
 * @returns {String} the HTTP response that downloads the file
 */
function rawFileResponse (name, format, text) {
  return [
    'HTTP/1.1 200 OK',
    `Content-Type: ${contentTypeOfFormat(format)}`,
    `Content-Disposition: attachment; filename="${name}.${format}"`,
    '',
    text === undefined ? '[file content]' : text,
  ].join('\n');
}

/**
 * @param {String} name
 * @param {Object} [field] the File field, when there is one
 * @param {Object[]} columns
 * @param {String} side body or response
 * @returns {Object}
 */
function buildSpec (name, field, columns, side) {
  const allowed = field && field.allowedValues ? field.allowedValues : [];
  const formats = allowed.map(value => stripQuotes(value).toLowerCase());
  const described = columns.map(describeColumn);
  const delimiter = DELIMITERS[formats[0]];
  const header = described.map(column => column.name);
  const row = described.map(column => column.example);
  const text = delimiter === undefined ? undefined : delimitedText([header, row], delimiter);
  const response = side === 'response' && formats.length > 0 ? rawFileResponse(name, formats[0], text) : undefined;
  return {
    name,
    side,
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
    text,
    response,
    tabs: [{ key: 'sheet', title: 'Preview' }, ...text === undefined ? [] : [{ key: 'text', title: formats[0].toUpperCase() }], ...response === undefined ? [] : [{ key: 'response', title: 'Response' }]],
    tabbed: text !== undefined || response !== undefined,
  };
}

/**
 * The File fields that have columns, for the request body and for the response, plus one entry for every
 * group of columns that matches no File field. Columns written without a (file) belong to the first File
 * field of the body, or of the response when the body has none.
 *
 * @param {Object} endpoint
 * @param {Object[]} [endpoint.body] @apiBody entries
 * @param {Object} [endpoint.success] the success fields, by group
 * @param {Object[]} [endpoint.fileColumns] @apiFileColumn entries
 * @returns {{body: Object[], response: Object[]}}
 */
export function describeAllFiles ({ body, success, fileColumns }) {
  const bodyFiles = (body || []).filter(field => isFileType(field.type));
  const groups = success && success.fields ? success.fields : {};
  const responseFields = Object.values(groups).flat();
  const responseFiles = responseFields.filter(field => isFileType(field.type));
  const allColumns = fileColumns || [];
  const owner = bodyFiles[0] || responseFiles[0];
  const assigned = new Set();

  const belongsTo = (file, name) => column => {
    if (assigned.has(column)) { return false; }
    if (column.group === name) { return true; }
    return file === owner && column.group === UNSPECIFIED_FILE;
  };
  const specsFor = (files, side) => files.flatMap(file => {
    const name = unquoteField(file.field);
    const mine = allColumns.filter(belongsTo(file, name));
    mine.forEach(column => assigned.add(column));
    if (mine.length === 0) { return []; }
    return [buildSpec(name, file, mine, side)];
  });

  const bodySpecs = specsFor(bodyFiles, 'body');
  const responseSpecs = specsFor(responseFiles, 'response');
  const orphans = allColumns.filter(column => !assigned.has(column));
  [...new Set(orphans.map(column => column.group))].forEach(group => {
    bodySpecs.push(buildSpec(group, undefined, orphans.filter(column => column.group === group), 'body'));
  });
  return { body: bodySpecs, response: responseSpecs };
}

/**
 * @param {Object[]} [bodyFields] @apiBody entries
 * @param {Object[]} [columns] @apiFileColumn entries
 * @returns {Object[]} the files of the request body that have columns
 */
export function describeFiles (bodyFields, columns) {
  return describeAllFiles({ body: bodyFields, fileColumns: columns }).body;
}
