/**
 * OpenAPI 3.0 description of the parsed API: what `apidoc --openapi` writes as openapi.json.
 *
 * Pure functions: the data is the content of api-data.json, the project is the apidoc.json configuration.
 */
const semver = require('semver');

const FILE_CONTENT_TYPES = {
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
const STREAM_CONTENT_TYPES = { sse: 'text/event-stream', ndjson: 'application/x-ndjson' };
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const IGNORED_HEADERS = ['content-type', 'accept', 'authorization'];
const UNSPECIFIED_FILE = 'Columns';

const unquote = value => value.replace(/^["']|["']$/g, '');
const unquoteField = field => field.replace(/"/g, '');
const splitFieldPath = path => (path.match(/"[^"]*"|[^.]+/g) || []).map(unquoteField);
const groupsOf = section => {
  if (section && section.fields) { return section.fields; }
  return {};
};
const flatten = section => Object.values(groupsOf(section)).flat();
const isFileType = type => typeof type === 'string' && type.replace('[]', '').toLowerCase() === 'file';

/**
 * @param {String} html
 * @returns {String} the text of an HTML fragment
 */
function stripHtml (html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Object} field a parsed field
 * @returns {Object} JSON schema of the field
 */
function fieldSchema (field) {
  const raw = field.type || 'String';
  const isArray = raw.includes('[]');
  const base = raw.replace('[]', '').toLowerCase();

  let schema;
  if (base === 'number') {
    schema = { type: 'number' };
  } else if (base === 'boolean') {
    schema = { type: 'boolean' };
  } else if (base === 'file') {
    schema = { type: 'string', format: 'binary' };
  } else if (base === 'email') {
    schema = { type: 'string', format: 'email' };
  } else if (raw.replace('[]', '').includes('Object')) {
    schema = { type: 'object', properties: {} };
  } else {
    schema = { type: 'string' };
  }

  const range = (field.size || '').match(/^(\d+)?\s*\.\.\s*(\d+)?$/);
  if (range && schema.type === 'string') {
    if (range[1]) { schema.minLength = Number(range[1]); }
    if (range[2]) { schema.maxLength = Number(range[2]); }
  } else if (range && schema.type === 'number') {
    if (range[1]) { schema.minimum = Number(range[1]); }
    if (range[2]) { schema.maximum = Number(range[2]); }
  }

  if (field.allowedValues && field.allowedValues.length > 0 && base !== 'file') {
    const convert = schema.type === 'number' ? Number : String;
    schema.enum = field.allowedValues.map(value => convert(unquote(value)));
  }
  if (field.defaultValue !== undefined && base !== 'file' && schema.type !== 'object') {
    schema.default = schema.type === 'number' ? Number(field.defaultValue) : schema.type === 'boolean' ? field.defaultValue !== 'false' : field.defaultValue;
  }
  const description = stripHtml(field.description);
  if (description) { schema.description = description; }

  return isArray ? { type: 'array', items: schema } : schema;
}

/**
 * @param {Object} schema
 * @returns {Object} the object that holds the properties of a (possibly array of) object schema
 */
function containerOf (schema) {
  const target = schema.type === 'array' ? schema.items : schema;
  if (!target.properties) { target.properties = {}; }
  return target;
}

/**
 * @param {Object[]} fields parsed fields, parents before their children
 * @returns {Object} an object schema with the nested fields
 */
function objectSchema (fields) {
  const root = { type: 'object', properties: {} };
  const required = new Map([[root, []]]);

  fields.forEach(field => {
    let node = root;
    const parents = field.parentNode ? splitFieldPath(field.parentNode.path) : [];
    parents.forEach(segment => {
      if (!node.properties[segment]) { node.properties[segment] = { type: 'object', properties: {} }; }
      node = containerOf(node.properties[segment]);
      if (!required.has(node)) { required.set(node, []); }
    });

    const key = unquoteField(field.parentNode ? field.field.slice(field.parentNode.path.length + 1) : field.field);
    node.properties[key] = fieldSchema(field);
    if (!field.optional) { required.get(node).push(key); }
  });

  required.forEach((names, node) => {
    if (names.length > 0) { node.required = names; }
  });
  return root;
}

/**
 * Same rules as bodyKind in template/src/body_kind.mjs.
 *
 * @param {Object} article
 * @returns {String}
 */
function bodyMime (article) {
  if (article.contentType) { return article.contentType; }
  return (article.body || []).some(field => isFileType(field.type)) ? 'multipart/form-data' : 'application/json';
}

/**
 * @param {Object} article
 * @returns {String}
 */
function bodyKind (article) {
  const mime = bodyMime(article);
  if (mime.startsWith('multipart/')) { return 'multipart'; }
  if (mime === 'application/x-www-form-urlencoded') { return 'urlencoded'; }
  if (mime === 'application/json' || mime.endsWith('+json')) { return 'json'; }
  if (mime.includes('xml')) { return 'xml'; }
  if (mime.startsWith('text/')) { return 'text'; }
  return 'binary';
}

/**
 * @param {Object} file the File field
 * @param {Object[]} columns the @apiFileColumn entries
 * @param {Object[]} allFiles every File field of the endpoint
 * @returns {String} a description of the expected columns, when there are some
 */
function columnsDescription (file, columns, allFiles) {
  const name = unquoteField(file.field);
  const belongs = column => {
    if (column.group === name) { return true; }
    return column.group === UNSPECIFIED_FILE && allFiles[0] === file;
  };
  const mine = columns.filter(belongs);
  if (mine.length === 0) { return ''; }
  return `Columns, in order: ${mine.map(column => `${unquoteField(column.field)} (${column.type}${column.optional ? ', optional' : ''})`).join(', ')}.`;
}

/**
 * @param {Object} article
 * @returns {Object|undefined} the requestBody of the operation
 */
function requestBody (article) {
  const fields = article.body || [];
  if (fields.length === 0) { return undefined; }
  const kind = bodyKind(article);
  const mime = bodyMime(article);
  const files = fields.filter(field => isFileType(field.type));
  const columns = article.fileColumns || [];

  let schema;
  if (kind === 'json' || kind === 'urlencoded' || kind === 'multipart') {
    schema = objectSchema(fields);
    files.forEach(file => {
      const note = columnsDescription(file, columns, files);
      const key = unquoteField(file.field);
      const target = schema.properties[key];
      if (note && target) { (target.items || target).description = [(target.items || target).description, note].filter(Boolean).join(' '); }
    });
  } else if (kind === 'binary') {
    schema = { type: 'string', format: 'binary' };
  } else {
    const examples = article.parameter && article.parameter.examples ? article.parameter.examples : [];
    schema = { type: 'string' };
    if (examples.length > 0) { schema.example = examples[0].content; }
  }

  return {
    required: fields.some(field => !field.optional),
    content: { [mime]: { schema } },
  };
}

/**
 * @param {Object} article
 * @returns {Object[]} OpenAPI parameters: path, query and header
 */
function parameters (article) {
  const documented = flatten(article.parameter);
  const result = [];

  (article.url.match(/:(\w+)|\{(\w+)\}/g) || []).forEach(token => {
    const name = token.replace(/^:|^\{|\}$/g, '');
    const field = documented.find(candidate => candidate.field === name);
    const schema = field ? fieldSchema(field) : { type: 'string' };
    const description = schema.description;
    delete schema.description;
    result.push(Object.assign({ name, in: 'path', required: true, schema }, description ? { description } : {}));
  });

  const toParameter = location => field => {
    const schema = fieldSchema(field);
    const description = schema.description;
    delete schema.description;
    return Object.assign({ name: field.field, in: location, required: !field.optional, schema }, description ? { description } : {});
  };
  (article.query || []).forEach(field => result.push(toParameter('query')(field)));
  flatten(article.header)
    .filter(field => !IGNORED_HEADERS.includes(field.field.toLowerCase()))
    .forEach(field => result.push(toParameter('header')(field)));
  return result;
}

/**
 * @param {String} group name of a success or error group, such as "Success 200", "201 Created" or "Error 4xx"
 * @param {Boolean} isError
 * @returns {String} the status code, a range such as 4XX, or default
 */
function statusOf (group, isError) {
  const code = group.match(/\b([1-5]\d{2})\b/);
  if (code) { return code[1]; }
  const range = group.match(/\b([1-5])xx\b/i);
  if (range) { return `${range[1]}XX`; }
  return isError ? 'default' : '200';
}

/**
 * @param {String} content the content of a response example
 * @returns {*} the JSON in it, if it has any
 */
function jsonOf (content) {
  const start = content.search(/[{[]/);
  if (start < 0) { return undefined; }
  try { return JSON.parse(content.slice(start)); } catch (error) { return undefined; }
}

/**
 * @param {Object} article
 * @returns {Object} the responses of the operation, by status
 */
function responses (article) {
  const result = {};
  const streaming = article.streaming ? STREAM_CONTENT_TYPES[article.streaming.type] : undefined;
  const columns = article.fileColumns || [];

  const add = (group, fields, isError) => {
    const status = statusOf(group, isError);
    const entry = result[status] || { description: group };
    if (result[status] && !entry.description.includes(group)) { entry.description += `; ${group}`; }

    if (isError) {
      const listed = fields.map(field => `${field.field}: ${stripHtml(field.description)}`).join('. ');
      if (listed) { entry.description = `${entry.description}. ${listed}`; }
    } else if (fields.some(field => isFileType(field.type))) {
      const file = fields.find(field => isFileType(field.type));
      const format = file.allowedValues && file.allowedValues.length > 0 ? unquote(file.allowedValues[0]).toLowerCase() : '';
      const note = columnsDescription(file, columns, [file]);
      if (note) { entry.description += ` ${note}`; }
      entry.content = { [FILE_CONTENT_TYPES[format] || 'application/octet-stream']: { schema: { type: 'string', format: 'binary' } } };
    } else if (fields.length > 0) {
      const mime = streaming || 'application/json';
      entry.content = { [mime]: { schema: objectSchema(fields) } };
    }
    result[status] = entry;
  };

  Object.entries(groupsOf(article.success)).forEach(([group, fields]) => add(group, fields, false));
  Object.entries(groupsOf(article.error)).forEach(([group, fields]) => add(group, fields, true));

  const firstSuccess = Object.keys(result).find(status => status.startsWith('2')) || Object.keys(result)[0];
  const givenExamples = article.success && article.success.examples ? article.success.examples : [];
  const example = givenExamples.map(item => jsonOf(item.content)).find(value => value !== undefined);
  if (example !== undefined && firstSuccess && result[firstSuccess].content && result[firstSuccess].content['application/json']) {
    result[firstSuccess].content['application/json'].example = example;
  }

  Object.entries(groupsOf(article.responseHeader)).forEach(([group, fields]) => {
    const status = /\b[1-5]\d{2}\b/.test(group) ? statusOf(group, false) : firstSuccess;
    if (!status) { return; }
    result[status] = result[status] || { description: group };
    result[status].headers = result[status].headers || {};
    fields.forEach(field => {
      const schema = fieldSchema(field);
      const description = schema.description || stripHtml(field.description);
      delete schema.description;
      result[status].headers[field.field] = Object.assign({ schema }, description ? { description } : {});
    });
  });

  return Object.keys(result).length > 0 ? result : { 200: { description: 'Successful response' } };
}

/**
 * @param {Object[]} schemes the auth key of apidoc.json
 * @returns {Object} OpenAPI security schemes, by a name that is safe to use as a key
 */
function securitySchemes (schemes) {
  const result = {};
  (schemes || []).forEach(scheme => {
    const key = scheme.name.replace(/[^A-Za-z0-9._-]/g, '_');
    if (scheme.type === 'bearer' && (scheme.header || 'Authorization') === 'Authorization' && !scheme.prefix) {
      result[key] = { type: 'http', scheme: 'bearer' };
    } else if (scheme.type === 'bearer') {
      result[key] = { type: 'apiKey', in: 'header', name: scheme.header || 'Authorization', description: `${scheme.prefix || 'Bearer'} <token>` };
    } else if (scheme.type === 'apiKey') {
      result[key] = { type: 'apiKey', in: scheme.in === 'query' ? 'query' : 'header', name: scheme.param || 'X-API-Key' };
    } else if (scheme.type === 'basic') {
      result[key] = { type: 'http', scheme: 'basic' };
    }
  });
  return result;
}

/**
 * The newest version of each method and path.
 *
 * @param {Object[]} data
 * @returns {Object[]}
 */
function latestVersions (data) {
  const newest = new Map();
  data.forEach(article => {
    const key = `${String(article.type).toLowerCase()}:${article.url}`;
    const known = newest.get(key);
    const isNewer = known && semver.valid(article.version) && semver.valid(known.version) && semver.gt(article.version, known.version);
    if (!known || isNewer) { newest.set(key, article); }
  });
  return [...newest.values()];
}

/**
 * @param {Object} article
 * @param {Object} securityNames names of the security schemes, in the same order as the project
 * @returns {Object} the operation
 */
function operation (article, securityNames) {
  const result = {
    tags: [article.groupTitle || article.group],
    summary: article.title,
    operationId: article.name,
  };
  const description = stripHtml(article.description);
  if (description) { result.description = description; }
  if (article.deprecated) { result.deprecated = true; }

  const params = parameters(article);
  if (params.length > 0) { result.parameters = params; }
  const body = requestBody(article);
  if (body) { result.requestBody = body; }
  result.responses = responses(article);

  const permissions = (article.permission || []).map(permission => permission.name);
  if (permissions.includes('none') && securityNames.length > 0) {
    result.security = [];
  } else if (permissions.length > 0) {
    result['x-permissions'] = permissions;
  }
  if (article.streaming) { result['x-streaming'] = article.streaming; }
  return result;
}

/**
 * @param {Object[]} data the parsed blocks (api-data.json)
 * @param {Object} project the apidoc.json configuration
 * @returns {Object} the OpenAPI 3.0 document
 */
function toOpenApi (data, project) {
  const schemes = securitySchemes(project.auth);
  const securityNames = Object.keys(schemes);
  const document = {
    openapi: '3.0.3',
    info: { title: project.title || project.name || 'API', version: project.version || '1.0.0' },
  };
  if (project.description) { document.info.description = project.description; }

  const servers = (project.environments || []).map(environment => ({ url: environment.url, description: environment.name }));
  if (servers.length === 0 && project.url) { servers.push({ url: project.url }); }
  if (servers.length > 0) { document.servers = servers; }

  const paths = {};
  const webhooks = {};
  const tags = new Map();
  const operationIds = new Set();

  latestVersions(data).forEach(article => {
    const method = String(article.type).toLowerCase();
    if (!HTTP_METHODS.includes(method)) { return; }
    const built = operation(article, securityNames);
    if (operationIds.has(built.operationId)) { built.operationId = `${article.group}_${built.operationId}`; }
    operationIds.add(built.operationId);
    tags.set(built.tags[0], true);

    if (article.webhook) {
      webhooks[article.name] = { [method]: built };
      return;
    }
    const path = article.url.replace(/:(\w+)/g, '{$1}');
    paths[path] = Object.assign(paths[path] || {}, { [method]: built });
  });

  document.tags = [...tags.keys()].map(name => ({ name }));
  document.paths = paths;
  if (Object.keys(webhooks).length > 0) { document['x-webhooks'] = webhooks; }
  if (securityNames.length > 0) {
    document.components = { securitySchemes: schemes };
    document.security = securityNames.map(name => ({ [name]: [] }));
  }
  return document;
}

module.exports = { bodyKind, toOpenApi };
