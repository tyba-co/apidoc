/**
 * Credentials and environments of the sample requests, from the auth and environments keys of apidoc.json.
 */

/**
 * @param {String} text
 * @returns {String} the text as UTF-8 in base64
 */
function toBase64 (text) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The headers and query parameters that carry the credentials.
 *
 * @param {Object[]} schemes the auth key: {name, type: bearer|apiKey|basic, header?, prefix?, in?, param?}
 * @param {Object} credentials by scheme name: {token} for bearer, {value} for apiKey, {username, password} for basic
 * @returns {{headers: Object, query: Object}}
 */
export function authRequest (schemes, credentials) {
  const headers = {};
  const query = {};

  (schemes || []).forEach(scheme => {
    const given = (credentials || {})[scheme.name];
    if (!given) { return; }

    if (scheme.type === 'bearer' && given.token) {
      headers[scheme.header || 'Authorization'] = `${scheme.prefix || 'Bearer'} ${given.token}`;
    } else if (scheme.type === 'apiKey' && given.value) {
      const target = scheme.in === 'query' ? query : headers;
      target[scheme.param || 'X-API-Key'] = given.value;
    } else if (scheme.type === 'basic' && given.username) {
      headers.Authorization = `Basic ${toBase64(`${given.username}:${given.password || ''}`)}`;
    }
  });

  return { headers, query };
}

/**
 * @param {Object[]} schemes
 * @param {Object} credentials
 * @returns {String[]} names of the schemes that have credentials
 */
export function authorizedSchemes (schemes, credentials) {
  return (schemes || []).filter(scheme => {
    const given = (credentials || {})[scheme.name] || {};
    return Boolean(given.token || given.value || given.username);
  }).map(scheme => scheme.name);
}

/**
 * The URL of a sample request in another environment: what comes after the sample URL (or after the
 * origin when the URL does not start with it) is kept, and the environment URL goes in front.
 *
 * @param {String} url
 * @param {String} environmentUrl
 * @param {String} [sampleUrl] the sampleUrl of apidoc.json
 * @returns {String}
 */
export function inEnvironment (url, environmentUrl, sampleUrl) {
  const base = environmentUrl.replace(/\/+$/, '');
  if (sampleUrl && url.startsWith(sampleUrl)) { return base + url.slice(sampleUrl.length); }
  try {
    const { origin } = new URL(url);
    return base + url.slice(origin.length);
  } catch (error) {
    return url;
  }
}

/**
 * @param {String} url
 * @param {Object} query parameters to add
 * @returns {String}
 */
export function withQuery (url, query) {
  const entries = Object.entries(query || {});
  if (entries.length === 0) { return url; }
  const separator = url.includes('?') ? '&' : '?';
  return url + separator + entries.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&');
}
