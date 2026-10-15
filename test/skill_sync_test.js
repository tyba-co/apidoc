/**
 * Agent skill tests
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readRegisteredParserTags } = require('./support/registered_parser_tags');
const { validateWithApidoc } = require('./support/validate_with_apidoc');

const repoRoot = path.join(__dirname, '..');
const skillRoot = path.join(repoRoot, 'skills', 'apidoc');
const tagsWithoutParser = ['apiignore'];
const documentedNonTags = ['apistructure', 'apierrorstructure', 'apisuccessstructure', 'apiheaderstructure'];

/**
 * @returns {String[]} absolute paths of every markdown file of the skill
 */
function listSkillMarkdownFiles () {
  const referencesDir = path.join(skillRoot, 'references');
  return [path.join(skillRoot, 'SKILL.md')]
    .concat(fs.readdirSync(referencesDir).filter(name => name.endsWith('.md')).map(name => path.join(referencesDir, name)));
}

/**
 * @param {String} markdown
 * @returns {String[]} lowercase names of every @api token in the text, without the leading @
 */
function readApiTagTokens (markdown) {
  return [...markdown.matchAll(/@(api\w*)/g)].map(match => match[1].toLowerCase());
}

/**
 * @param {String} markdown
 * @returns {String[]} bodies of the ```js fences
 */
function readJsFences (markdown) {
  return [...markdown.matchAll(/^```js\n([\s\S]*?)^```$/gm)].map(match => match[1]);
}

describe('apidoc agent skill', function () {
  const skillMarkdown = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
  const markdownFiles = listSkillMarkdownFiles();
  const registeredTags = readRegisteredParserTags();

  it('has portable frontmatter with only name and description', function () {
    // ARRANGE
    const frontmatter = skillMarkdown.match(/^---\n([\s\S]*?)\n---\n/);

    // ACT
    const keys = frontmatter[1].split('\n').map(line => line.split(':')[0]);
    const description = frontmatter[1].match(/^description: (.+)$/m)[1];

    // ASSERT
    assert.deepStrictEqual(keys, ['name', 'description']);
    assert.match(frontmatter[1], /^name: apidoc$/m);
    assert.ok(description.length > 0 && description.length < 1024);
  });

  it('keeps SKILL.md short and links only to existing references', function () {
    // ARRANGE
    const linkedFiles = [...skillMarkdown.matchAll(/\]\((references\/[\w-]+\.md)\)/g)].map(match => match[1]);

    // ACT
    const missingFiles = linkedFiles.filter(file => !fs.existsSync(path.join(skillRoot, file)));

    // ASSERT
    assert.ok(skillMarkdown.split('\n').length < 150);
    assert.ok(linkedFiles.length > 0);
    assert.deepStrictEqual(missingFiles, []);
  });

  it('documents every registered parser in references/tags.md', function () {
    // ARRANGE
    const tagsMarkdown = fs.readFileSync(path.join(skillRoot, 'references', 'tags.md'), 'utf8');

    // ACT
    const documentedTags = new Set(readApiTagTokens(tagsMarkdown));
    const undocumentedTags = registeredTags.filter(tag => !documentedTags.has(tag));

    // ASSERT
    assert.strictEqual(registeredTags.length, fs.readdirSync(path.join(repoRoot, 'lib', 'core', 'parsers')).length);
    assert.deepStrictEqual(undocumentedTags, []);
  });

  it('mentions no tag that apidoc does not know', function () {
    // ARRANGE
    const knownTags = new Set(registeredTags.concat(tagsWithoutParser, documentedNonTags));

    // ACT
    const unknownTags = markdownFiles
      .flatMap(file => readApiTagTokens(fs.readFileSync(file, 'utf8')))
      .filter(tag => !knownTags.has(tag));

    // ASSERT
    assert.deepStrictEqual([...new Set(unknownTags)], []);
  });

  it('rejects an invalid block, proving the example check can fail', function () {
    // ARRANGE
    const invalidBlock = '/**\n * @api {get} /users Get users\n * @apiName GetUsers\n * @apiGroup User\n * @apiVersion 1.x\n */\n';

    // ACT
    const exitCode = validateWithApidoc(invalidBlock);

    // ASSERT
    assert.notStrictEqual(exitCode, 0);
  });

  markdownFiles.forEach(file => {
    readJsFences(fs.readFileSync(file, 'utf8')).forEach((fence, index) => {
      it(`validates js example ${index + 1} of ${path.relative(skillRoot, file)}`, function () {
        // ACT
        const exitCode = validateWithApidoc(fence);

        // ASSERT
        assert.strictEqual(exitCode, 0);
      }).timeout(20000);
    });
  });
});
