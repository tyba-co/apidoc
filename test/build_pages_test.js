/**
 * Documentation site tests
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildDocs, pageFiles } = require('../scripts/build-pages');
const { readRegisteredParserTags } = require('./support/registered_parser_tags');
const { validateWithApidoc } = require('./support/validate_with_apidoc');

const docsSourceDir = path.join(__dirname, '..', 'docs');

/**
 * @param {String} markdown
 * @returns {String[]} bodies of the ```js fences
 */
function readJsFences (markdown) {
  return [...markdown.matchAll(/^```js\n([\s\S]*?)^```$/gm)].map(match => match[1]);
}

describe('documentation site', function () {
  let outputDir;

  before(function () {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apidoc-pages-'));
    buildDocs(outputDir);
  });

  after(function () {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('writes the single docs page with its assets', function () {
    // ARRANGE
    const expectedFiles = ['index.html', 'assets/bootstrap.min.css', 'assets/bootstrap.bundle.min.js', 'assets/prism.css', 'assets/docs.css', 'assets/docs.js'];

    // ACT
    const missingFiles = expectedFiles.filter(file => !fs.existsSync(path.join(outputDir, file)));

    // ASSERT
    assert.deepStrictEqual(missingFiles, []);
  });

  it('documents every registered parser as a param-* section, like apidocjs.com', function () {
    // ARRANGE
    const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    const documentedTags = new Set([...html.matchAll(/<h3 id="param-([^"]+)">/g)].map(match => match[1].replace(/-/g, '')));

    // ACT
    const undocumentedTags = readRegisteredParserTags().concat('apiignore')
      .filter(tag => !documentedTags.has(tag));

    // ASSERT
    assert.deepStrictEqual(undocumentedTags, []);
  });

  it('links only to anchors that exist and leaves no markdown links behind', function () {
    // ARRANGE
    const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]));

    // ACT
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1]);
    const brokenLinks = hrefs
      .filter(href => !/^(https?:|mailto:|\.\.\/)/.test(href))
      .filter(href => !ids.has(href.replace(/^#/, '')) || !href.startsWith('#'));

    // ASSERT
    assert.deepStrictEqual(brokenLinks, []);
    assert.ok(!hrefs.some(href => href.includes('.md')));
  });

  pageFiles.forEach(file => {
    readJsFences(fs.readFileSync(path.join(docsSourceDir, file), 'utf8')).forEach((fence, index) => {
      it(`validates js example ${index + 1} of ${file}`, function () {
        // ACT
        const exitCode = validateWithApidoc(fence);

        // ASSERT
        assert.strictEqual(exitCode, 0);
      }).timeout(20000);
    });
  });
});
