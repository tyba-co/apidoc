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

  it('writes every page with its assets', function () {
    // ARRANGE
    const expectedFiles = pageFiles.map(file => file.replace(/\.md$/, '.html'))
      .concat(['assets/bootstrap.min.css', 'assets/bootstrap.bundle.min.js', 'assets/prism.css', 'assets/docs.css']);

    // ACT
    const missingFiles = expectedFiles.filter(file => !fs.existsSync(path.join(outputDir, file)));

    // ASSERT
    assert.deepStrictEqual(missingFiles, []);
  });

  it('documents every registered parser as a heading of the tag reference', function () {
    // ARRANGE
    const tagsHtml = fs.readFileSync(path.join(outputDir, 'tags.html'), 'utf8');

    // ACT
    const undocumentedTags = readRegisteredParserTags().concat('apiignore')
      .filter(tag => !tagsHtml.includes(`<h3 id="${tag}">`));

    // ASSERT
    assert.deepStrictEqual(undocumentedTags, []);
  });

  it('links only to pages and anchors that exist', function () {
    // ARRANGE
    const idsByPage = {};
    const htmlByPage = {};
    pageFiles.forEach(file => {
      const page = file.replace(/\.md$/, '.html');
      htmlByPage[page] = fs.readFileSync(path.join(outputDir, page), 'utf8');
      idsByPage[page] = new Set([...htmlByPage[page].matchAll(/ id="([^"]+)"/g)].map(match => match[1]));
    });

    // ACT
    const brokenLinks = [];
    Object.entries(htmlByPage).forEach(([page, html]) => {
      [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1])
        .filter(href => !/^(https?:|mailto:|\.\.\/)/.test(href))
        .forEach(href => {
          const [target, anchor] = href.split('#');
          const targetPage = target || page;
          if (!idsByPage[targetPage] || (anchor && !idsByPage[targetPage].has(anchor))) { brokenLinks.push(`${page} -> ${href}`); }
        });
    });

    // ASSERT
    assert.deepStrictEqual(brokenLinks, []);
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
