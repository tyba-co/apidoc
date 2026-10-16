/**
 * Examples of the request of an endpoint whose body is not plain JSON: raw HTTP plus the equivalent curl command.
 */
import { bodyKind, bodyMime } from './body_kind.mjs';
import { buildParts, multipartExample, splitUrl } from './multipart_example.mjs';
import { isFileType } from './file_columns.mjs';

const extensionOf = mime => {
  if (!mime.includes('/')) { return 'bin'; }
  return mime.split('/')[1].replace(/^.*\+/, '');
};

/**
 * @param {Object} article
 * @returns {{method: String, path: String, host: String}}
 */
function requestLine (article) {
  const { path, host } = splitUrl(article.url || '');
  return { method: (article.type || 'post').toUpperCase(), path, host };
}

/**
 * @param {Object} article
 * @param {String} mime
 * @param {String[]} body lines after the blank line
 * @returns {String}
 */
function rawRequest (article, mime, body) {
  const { method, path, host } = requestLine(article);
  return [`${method} ${path} HTTP/1.1`, ...host ? [`Host: ${host}`] : [], `Content-Type: ${mime}`, '', ...body].join('\n');
}

/**
 * @param {Object} article
 * @returns {{raw: String, curl: String}}
 */
function urlencodedExample (article) {
  const fields = buildParts(article.body || [], []).filter(part => part.filename === undefined);
  const { method } = requestLine(article);
  const raw = rawRequest(article, 'application/x-www-form-urlencoded', [fields.map(field => `${encodeURIComponent(field.name)}=${encodeURIComponent(field.content)}`).join('&')]);
  const flags = fields.map(field => `  --data-urlencode "${field.name}=${field.content.replace(/"/g, '\\"')}"`);
  return { raw, curl: [`curl -X ${method} "${article.url || ''}"`, ...flags].join(' \\\n') };
}

/**
 * @param {Object} article
 * @returns {{raw: String, curl: String}}
 */
function binaryExample (article) {
  const mime = bodyMime(article);
  const file = (article.body || []).find(field => isFileType(field.type));
  const format = file && file.allowedValues && file.allowedValues.length > 0 ? file.allowedValues[0].replace(/^["']|["']$/g, '').toLowerCase() : extensionOf(mime);
  const name = `${file ? file.field.replace(/"/g, '') : 'file'}.${format}`;
  const { method } = requestLine(article);
  return {
    raw: rawRequest(article, mime, ['[binary content]']),
    curl: [`curl -X ${method} "${article.url || ''}"`, `  -H "Content-Type: ${mime}"`, `  --data-binary @${name}`].join(' \\\n'),
  };
}

/**
 * @param {Object} article the endpoint, with body, fileColumns, contentType, type and url
 * @returns {{key: String, title: String, language: String, code: String}[]|undefined} the tabs of the example, or nothing for JSON, XML and text bodies
 */
export function requestExample (article) {
  const builders = { multipart: multipartExample, urlencoded: urlencodedExample, binary: binaryExample };
  const build = builders[bodyKind(article)];
  if (!build || !article.body || article.body.length === 0) { return undefined; }
  const { raw, curl } = build(article);
  return [
    { key: 'raw', title: bodyKind(article) === 'multipart' ? 'Multipart' : 'Request', language: 'http', code: raw },
    { key: 'curl', title: 'cURL', language: 'bash', code: curl },
  ];
}
