/**
 * How the body of an endpoint is encoded: declared with @apiContentType, else multipart when it has a File field, else JSON.
 */
import { hasFiles } from './file_columns.mjs';

const MULTIPART = 'multipart/form-data';
const URLENCODED = 'application/x-www-form-urlencoded';
const JSON_TYPE = 'application/json';

/**
 * @param {Object} article
 * @returns {String} the Content-Type of the request body
 */
export function bodyMime (article) {
  if (article.contentType) { return article.contentType; }
  return hasFiles(article.body) ? MULTIPART : JSON_TYPE;
}

/**
 * @param {Object} article
 * @returns {String} json, multipart, urlencoded, xml, text or binary
 */
export function bodyKind (article) {
  const mime = bodyMime(article);
  if (mime.startsWith('multipart/')) { return 'multipart'; }
  if (mime === URLENCODED) { return 'urlencoded'; }
  if (mime === JSON_TYPE || mime.endsWith('+json')) { return 'json'; }
  if (mime.includes('xml')) { return 'xml'; }
  if (mime.startsWith('text/')) { return 'text'; }
  return 'binary';
}

/**
 * @param {Object} article
 * @returns {Boolean} whether the Content-Type deserves a mark next to the Request Body title
 */
export const hasNotableMime = article => bodyMime(article) !== JSON_TYPE;
