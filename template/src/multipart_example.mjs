/**
 * Example of the multipart/form-data request of an endpoint whose body has File fields.
 */
import { describeFiles, exampleValue, isFileType } from './file_columns.mjs';
import { formFieldName, unquoteField } from './field_path.mjs';

const BOUNDARY = '----apidoc-boundary';
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

/**
 * @param {Object[]} bodyFields
 * @param {Object[]} specs result of describeFiles
 * @returns {Object[]} one part per file (two for File[]) and one per scalar field, in body order
 */
export function buildParts (bodyFields, specs) {
  const parts = [];
  bodyFields.forEach(field => {
    if (isFileType(field.type)) {
      const name = unquoteField(field.field);
      const format = field.allowedValues && field.allowedValues.length > 0 ? field.allowedValues[0].replace(/^["']|["']$/g, '').toLowerCase() : '';
      const spec = specs.find(candidate => candidate.name === name);
      const copies = field.type.includes('[]') ? 2 : 1;
      for (let copy = 1; copy <= copies; copy += 1) {
        parts.push({
          name,
          filename: format ? `${name}${copies > 1 ? copy : ''}.${format}` : `${name}${copies > 1 ? copy : ''}`,
          contentType: CONTENT_TYPES[format] || 'application/octet-stream',
          content: spec && spec.text !== undefined ? spec.text : '[file content]',
        });
      }
    } else if (!(field.type || '').includes('Object')) {
      parts.push({ name: formFieldName(field), content: exampleValue(field) });
    }
  });
  return parts;
}

/**
 * @param {String} url
 * @returns {{path: String, host: String}}
 */
function splitUrl (url) {
  try {
    const parsed = new URL(url);
    return { path: parsed.pathname + parsed.search, host: parsed.host };
  } catch (error) {
    return { path: url, host: '' };
  }
}

/**
 * @param {Object} article the endpoint, with body, fileColumns, type and url
 * @returns {{raw: String, curl: String}} the request as raw HTTP and as a curl command
 */
export function multipartExample (article) {
  const parts = buildParts(article.body || [], describeFiles(article.body, article.fileColumns));
  const method = (article.type || 'post').toUpperCase();
  const { path, host } = splitUrl(article.url || '');

  const rawParts = parts.map(part => {
    const disposition = `Content-Disposition: form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ''}`;
    const lines = part.filename ? [disposition, `Content-Type: ${part.contentType}`] : [disposition];
    return [`--${BOUNDARY}`, ...lines, '', part.content].join('\n');
  });
  const raw = [
    `${method} ${path} HTTP/1.1`,
    ...host ? [`Host: ${host}`] : [],
    `Content-Type: multipart/form-data; boundary=${BOUNDARY}`,
    '',
    ...rawParts,
    `--${BOUNDARY}--`,
  ].join('\n');

  const flags = parts.map(part => {
    const value = part.filename ? `@${part.filename};type=${part.contentType}` : part.content.replace(/"/g, '\\"');
    return `  -F "${part.name}=${value}"`;
  });
  const curl = [`curl -X ${method} "${article.url || ''}"`, ...flags].join(' \\\n');

  return { raw, curl };
}
