/**
 * The body a sample request sends, for each way of encoding it.
 */

const fileType = file => {
  if (!file) { return undefined; }
  return file.type;
};

/**
 * @param {Object} input
 * @param {String} input.encoding json, text, urlencoded, binary or multipart
 * @param {Object} [input.values] form values: strings, or File / File[] for file inputs
 * @param {String} [input.text] raw body for json and text
 * @param {File} [input.file] file for binary
 * @param {String} [input.mime] Content-Type for text and binary
 * @returns {{data: *, contentType: String|false}} contentType false lets the browser set the multipart boundary
 */
export function buildRequestBody ({ encoding, values, text, file, mime }) {
  const entries = Object.entries(values || {}).flatMap(([name, value]) => (Array.isArray(value) ? value : [value]).map(item => [name, item]));

  switch (encoding) {
    case 'json':
      return { data: text || '', contentType: mime || 'application/json' };
    case 'text':
      return { data: text || '', contentType: mime || 'text/plain' };
    case 'urlencoded': {
      const params = new URLSearchParams();
      entries.forEach(([name, value]) => params.append(name, value));
      return { data: params.toString(), contentType: 'application/x-www-form-urlencoded; charset=UTF-8' };
    }
    case 'binary':
      return { data: file, contentType: mime || fileType(file) || 'application/octet-stream' };
    default: {
      const formData = new FormData();
      entries.forEach(([name, value]) => formData.append(name, value));
      return { data: formData, contentType: false };
    }
  }
}
