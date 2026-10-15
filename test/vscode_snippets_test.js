/**
 * VS Code extension (vscode/) tests
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'vscode');
const apidocBin = path.join(repoRoot, 'bin', 'apidoc');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
const tagsWithoutParser = ['apiignore'];

/**
 * @returns {Object} lowercase tag name -> parser file name, as registered in lib/core/index.js app.parsers
 */
function readRegisteredParsers () {
  const indexSource = fs.readFileSync(path.join(repoRoot, 'lib', 'core', 'index.js'), 'utf8');
  return Object.fromEntries([...indexSource.matchAll(/(\w+): '\.\/parsers\/(\w+)\.js'/g)].map(match => [match[1], match[2]]));
}

/**
 * @param {String} snippetFile path relative to vscode/
 * @returns {Object} snippets keyed by name
 */
function readSnippets (snippetFile) {
  return JSON.parse(fs.readFileSync(path.join(extensionRoot, snippetFile), 'utf8'));
}

/**
 * Replace every tabstop with its default text, as if the user accepted the snippet as is.
 *
 * @param {String[]} bodyLines
 * @returns {String}
 */
function expandSnippetBody (bodyLines) {
  return bodyLines.join('\n')
    .replace(/\$\{\d+\|([^,|]*)[^|]*\|\}/g, '$1')
    .replace(/\$\{\d+:((?:\\\}|[^}])*)\}/g, '$1')
    .replace(/\$\d+/g, '')
    .replace(/\\([$}\\])/g, '$1');
}

/**
 * Same element split as Parser.prototype.findElements in lib/core/parser.js.
 *
 * @param {String} text
 * @returns {Object[]} elements with name, source and content
 */
function splitApiElements (text) {
  const elementsRegExp = /(@(api\w*)\s?(.*?)(?=￿[\s*]*@api|$))/gm;
  return [...text.replace(/\n/g, '￿').matchAll(elementsRegExp)].map(match => ({
    name: match[2].toLowerCase(),
    source: match[1].replace(/￿/g, '\n'),
    content: match[3].replace(/￿/g, '\n'),
  }));
}

/**
 * @param {String} source
 * @returns {Number} exit code of apidoc --dry-run --warn-error over a project holding only this source
 */
function validateWithApidoc (source) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-vscode-snippet-'));
  try {
    fs.writeFileSync(path.join(projectDir, 'apidoc.json'), JSON.stringify({ name: 'snippets', version: '1.0.0', description: 'snippets' }));
    fs.writeFileSync(path.join(projectDir, 'example.js'), source);
    return spawnSync(process.execPath, [apidocBin, '-i', projectDir, '-o', path.join(projectDir, 'out'), '-n', '--warn-error']).status;
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

describe('vscode extension', function () {
  const registeredParsers = readRegisteredParsers();
  const tagSnippets = Object.values(readSnippets('snippets/tags.json'));
  const blockSnippets = Object.values(readSnippets('snippets/blocks.json'));

  it('ships a square PNG icon of at least 128px, as the Marketplace requires', function () {
    // ARRANGE
    const png = fs.readFileSync(path.join(extensionRoot, manifest.icon));

    // ACT
    const signature = png.subarray(0, 8).toString('hex');
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];

    // ASSERT
    assert.strictEqual(signature, '89504e470d0a1a0a');
    assert.strictEqual(width, height);
    assert.ok(width >= 128);
  });

  it('contributes snippets only to languages that VS Code ships', function () {
    // ARRANGE
    const builtInLanguages = ['c', 'clojure', 'coffeescript', 'cpp', 'csharp', 'dart', 'go', 'groovy', 'java', 'javascript', 'javascriptreact', 'lua', 'perl', 'php', 'python', 'ruby', 'typescript', 'typescriptreact'];

    // ACT
    const languages = [...new Set(manifest.contributes.snippets.map(entry => entry.language))];
    const unknownLanguages = languages.filter(language => !builtInLanguages.includes(language));

    // ASSERT
    assert.deepStrictEqual(unknownLanguages, []);
  });

  it('lists only existing files in the manifest', function () {
    // ARRANGE
    const manifestPaths = manifest.contributes.snippets.map(entry => entry.path)
      .concat(manifest.contributes.jsonValidation.map(entry => entry.url))
      .concat(manifest.contributes.grammars.map(entry => entry.path))
      .concat(manifest.main)
      .concat(manifest.icon);

    // ACT
    const missingPaths = manifestPaths.filter(file => !fs.existsSync(path.join(extensionRoot, file)));

    // ASSERT
    assert.deepStrictEqual(missingPaths, []);
  });

  it('has a tag snippet for every registered parser', function () {
    // ARRANGE
    const snippetTags = new Set(tagSnippets.map(snippet => splitApiElements(snippet.body[0])[0].name));

    // ACT
    const tagsWithoutSnippet = Object.keys(registeredParsers).concat(tagsWithoutParser).filter(tag => !snippetTags.has(tag));

    // ASSERT
    assert.deepStrictEqual(tagsWithoutSnippet, []);
  });

  it('expands every tag snippet into elements the parsers accept', function () {
    // ARRANGE
    const elements = tagSnippets.flatMap(snippet => splitApiElements(expandSnippetBody(snippet.body)));

    // ACT
    const rejectedElements = elements
      .filter(element => !tagsWithoutParser.includes(element.name))
      .filter(element => {
        const parserFile = registeredParsers[element.name];
        if (!parserFile) { return true; }
        try {
          return !require(path.join(repoRoot, 'lib', 'core', 'parsers', parserFile)).parse(element.content, element.source);
        } catch (error) {
          return true;
        }
      })
      .map(element => element.source);

    // ASSERT
    assert.deepStrictEqual(rejectedElements, []);
  });

  it('never suggests bracket notation for nested fields', function () {
    // ACT
    const bracketBodies = tagSnippets.concat(blockSnippets)
      .map(snippet => expandSnippetBody(snippet.body))
      .filter(body => /\s[\w.]+\[[\w.]+\]/.test(body));

    // ASSERT
    assert.deepStrictEqual(bracketBodies, []);
  });

  blockSnippets.forEach(snippet => {
    it(`expands block snippet "${snippet.prefix}" into a block apidoc validates`, function () {
      // ACT
      const exitCode = validateWithApidoc(expandSnippetBody(snippet.body));

      // ASSERT
      assert.strictEqual(exitCode, 0);
    }).timeout(20000);
  });

  it('describes every key used by example/apidoc.json in the schema', function () {
    // ARRANGE
    const schema = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'schemas', 'apidoc.schema.json'), 'utf8'));
    const exampleConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'example', 'apidoc.json'), 'utf8'));

    // ACT
    const undescribedKeys = Object.keys(exampleConfig).filter(key => !schema.properties[key])
      .concat(Object.keys(exampleConfig.template).filter(key => !schema.properties.template.properties[key]));

    // ASSERT
    assert.deepStrictEqual(undescribedKeys, []);
  });

  it('offers exactly the template locales in forceLanguage', function () {
    // ARRANGE
    const schema = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'schemas', 'apidoc.schema.json'), 'utf8'));
    const localeSource = fs.readFileSync(path.join(repoRoot, 'template', 'src', 'locales', 'locale.mjs'), 'utf8');

    // ACT
    const localesBlock = localeSource.match(/const locales = \{([\s\S]*?)\};/)[1];
    const localeKeys = [...localesBlock.matchAll(/^\s*(\w+):/gm)].map(match => match[1]);

    // ASSERT
    assert.deepStrictEqual(schema.properties.template.properties.forceLanguage.enum.slice().sort(), localeKeys.slice().sort());
  });
});
