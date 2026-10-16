/**
 * The request of an endpoint as cURL, JavaScript (fetch) and Python (requests), from what is documented about it.
 */
import { bodyKind, bodyMime } from './body_kind.mjs';
import { exampleValue } from './file_columns.mjs';
import { body2json } from './jsonifier.mjs';
import { buildParts } from './multipart_example.mjs';

const flatten = groups => {
  const fields = groups && groups.fields ? groups.fields : {};
  return Object.values(fields).flat();
};
/**
 * @param {Object} field an @apiHeader entry
 * @returns {String} its example value, or a placeholder for a secret that has none
 */
function headerValue (field) {
  const allowed = field.allowedValues || [];
  if (field.defaultValue !== undefined || allowed.length > 0) { return exampleValue(field); }
  if (/authorization|token/i.test(field.field)) { return '<token>'; }
  if (/key|secret/i.test(field.field)) { return '<key>'; }
  return exampleValue(field);
}

const isPublic = article => (article.permission || []).some(permission => permission.name === 'none');

/**
 * @param {Object} article the endpoint
 * @param {Object} [project] apidoc.json, for the auth key
 * @returns {Object} method, url, query and header pairs, and the body in the way its format needs
 */
export function requestModel (article, project) {
  const kind = bodyKind(article);
  const pathParams = flatten(article.parameter);
  const url = (article.url || '').replace(/:(\w+)/g, (match, name) => {
    const param = pathParams.find(field => field.field === name);
    return param ? encodeURIComponent(exampleValue(param)) : match;
  });

  const query = (article.query || [])
    .filter(field => !field.optional || field.defaultValue !== undefined)
    .map(field => [field.field, exampleValue(field)]);
  const headers = flatten(article.header)
    .filter(field => !field.optional || field.defaultValue !== undefined)
    .map(field => [field.field, headerValue(field)]);

  (project && !isPublic(article) ? project.auth || [] : []).slice(0, 1).forEach(scheme => {
    const named = header => headers.some(([name]) => name.toLowerCase() === header.toLowerCase());
    if (scheme.type === 'bearer' && !named(scheme.header || 'Authorization')) {
      headers.push([scheme.header || 'Authorization', `${scheme.prefix || 'Bearer'} <token>`]);
    } else if (scheme.type === 'apiKey' && scheme.in === 'query') {
      query.push([scheme.param || 'api_key', '<key>']);
    } else if (scheme.type === 'apiKey' && !named(scheme.param || 'X-API-Key')) {
      headers.push([scheme.param || 'X-API-Key', '<key>']);
    } else if (scheme.type === 'basic' && !named('Authorization')) {
      headers.push(['Authorization', 'Basic <base64 of username:password>']);
    }
  });

  const body = {};
  const fields = article.body || [];
  if (fields.length > 0 || article.contentType) {
    if (kind === 'json') {
      body.json = JSON.parse(body2json(fields));
    } else if (kind === 'multipart' || kind === 'urlencoded') {
      body.parts = buildParts(fields, []);
    } else if (kind === 'binary') {
      const file = fields.find(field => field.type === 'File');
      body.file = { name: file ? `${file.field.replace(/"/g, '')}.${(file.allowedValues || ['"bin"'])[0].replace(/"/g, '')}` : 'file.bin' };
    } else {
      const given = article.parameter && article.parameter.examples ? article.parameter.examples : [];
      body.text = given.length > 0 ? given[0].content : '';
    }
  }

  return { method: (article.type || 'get').toUpperCase(), url, query, headers, kind, mime: bodyMime(article), body };
}

const quoteShell = text => `'${text.replace(/'/g, '\'\\\'\'')}'`;
const queryString = query => {
  if (query.length === 0) { return ''; }
  return `?${query.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&')}`;
};
const withContentType = model => {
  const needsHeader = ['json', 'xml', 'text', 'binary', 'urlencoded'].includes(model.kind) && Object.keys(model.body).length > 0;
  return needsHeader && !model.headers.some(([name]) => name.toLowerCase() === 'content-type') ? model.headers.concat([['Content-Type', model.mime]]) : model.headers;
};

/**
 * @param {Object} model result of requestModel
 * @returns {String}
 */
function curl (model) {
  const lines = [`curl -X ${model.method} "${model.url}${queryString(model.query)}"`];
  withContentType(model).forEach(([name, value]) => lines.push(`  -H "${name}: ${value}"`));
  const { body } = model;
  if (body.json !== undefined) {
    lines.push(`  -d ${quoteShell(JSON.stringify(body.json))}`);
  } else if (body.text !== undefined) {
    lines.push(`  -d ${quoteShell(body.text)}`);
  } else if (body.file) {
    lines.push(`  --data-binary @${body.file.name}`);
  } else if (body.parts) {
    body.parts.forEach(part => {
      if (model.kind === 'urlencoded') {
        lines.push(`  --data-urlencode "${part.name}=${part.content}"`);
      } else {
        lines.push(`  -F "${part.name}=${part.filename ? `@${part.filename};type=${part.contentType}` : part.content}"`);
      }
    });
  }
  return lines.join(' \\\n');
}

const jsString = text => `'${text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n')}'`;
const indent = (text, spaces) => text.split('\n').join(`\n${' '.repeat(spaces)}`);

/**
 * @param {Object} model
 * @returns {String}
 */
function javascript (model) {
  const lines = [];
  const options = [`  method: '${model.method}',`];
  const headers = withContentType(model).filter(([name]) => !(model.kind === 'multipart' && name.toLowerCase() === 'content-type'));
  const { body } = model;

  if (body.parts && model.kind === 'multipart') {
    lines.push('const form = new FormData();');
    body.parts.forEach(part => {
      lines.push(part.filename ? `form.append(${jsString(part.name)}, fileInput.files[0]); // ${part.filename}` : `form.append(${jsString(part.name)}, ${jsString(part.content)});`);
    });
    lines.push('');
  }
  if (headers.length > 0) {
    options.push('  headers: {', ...headers.map(([name, value]) => `    ${jsString(name)}: ${jsString(value)},`), '  },');
  }
  if (body.json !== undefined) {
    options.push(`  body: JSON.stringify(${indent(JSON.stringify(body.json, null, 2), 2)}),`);
  } else if (body.text !== undefined) {
    options.push(`  body: ${jsString(body.text)},`);
  } else if (body.file) {
    options.push(`  body: fileInput.files[0], // ${body.file.name}`);
  } else if (body.parts && model.kind === 'multipart') {
    options.push('  body: form,');
  } else if (body.parts) {
    options.push(`  body: new URLSearchParams([${body.parts.map(part => `[${jsString(part.name)}, ${jsString(part.content)}]`).join(', ')}]),`);
  }

  lines.push(`const response = await fetch(${jsString(model.url + queryString(model.query))}, {`, ...options, '});', 'const data = await response.json();');
  return lines.join('\n');
}

/**
 * @param {*} value
 * @param {Number} level
 * @returns {String} the value as a Python literal
 */
export function pythonLiteral (value, level = 0) {
  const pad = '    '.repeat(level + 1);
  const close = '    '.repeat(level);
  if (value === null) { return 'None'; }
  if (typeof value === 'boolean') { return value ? 'True' : 'False'; }
  if (typeof value === 'number') { return String(value); }
  if (typeof value === 'string') { return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n')}'`; }
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[\n${value.map(item => `${pad}${pythonLiteral(item, level + 1)},`).join('\n')}\n${close}]`;
  }
  const entries = Object.entries(value);
  return entries.length === 0 ? '{}' : `{\n${entries.map(([name, item]) => `${pad}${pythonLiteral(name)}: ${pythonLiteral(item, level + 1)},`).join('\n')}\n${close}}`;
}

/**
 * @param {Object} model
 * @returns {String}
 */
function python (model) {
  const args = [`    '${model.url}',`];
  const { body } = model;
  const setsItself = name => {
    if (model.kind === 'multipart') { return true; }
    return model.body.json !== undefined && name.toLowerCase() === 'content-type';
  };
  const headers = withContentType(model).filter(([name]) => !setsItself(name));
  if (model.query.length > 0) { args.push(`    params=${pythonLiteral(Object.fromEntries(model.query), 1)},`); }
  if (headers.length > 0) { args.push(`    headers=${pythonLiteral(Object.fromEntries(headers), 1)},`); }
  if (body.json !== undefined) {
    args.push(`    json=${pythonLiteral(body.json, 1)},`);
  } else if (body.text !== undefined) {
    args.push(`    data=${pythonLiteral(body.text)},`);
  } else if (body.file) {
    args.push(`    data=open('${body.file.name}', 'rb'),`);
  } else if (body.parts) {
    const files = body.parts.filter(part => part.filename);
    const fields = body.parts.filter(part => !part.filename);
    if (files.length > 0) {
      args.push(`    files={${files.map(part => `'${part.name}': ('${part.filename}', open('${part.filename}', 'rb'), '${part.contentType}')`).join(', ')}},`);
    }
    if (fields.length > 0) {
      args.push(`    data=${pythonLiteral(Object.fromEntries(fields.map(part => [part.name, part.content])), 1)},`);
    }
  }
  return ['import requests', '', `response = requests.${model.method.toLowerCase()}(`, ...args, ')', 'print(response.json())'].join('\n');
}

/**
 * @param {Object} article the endpoint
 * @param {Object} [project] apidoc.json
 * @returns {{key: String, title: String, language: String, code: String}[]}
 */
export function codeSamples (article, project) {
  const model = requestModel(article, project);
  return [
    { key: 'curl', title: 'cURL', language: 'bash', code: curl(model) },
    { key: 'javascript', title: 'JavaScript', language: 'javascript', code: javascript(model) },
    { key: 'python', title: 'Python', language: 'python', code: python(model) },
  ];
}
