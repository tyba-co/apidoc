/**
 * VS Code extension: context-aware completion
 */
const assert = require('assert');

const { collectNames, completionContext, getCompletions, isInsideComment, mergeNames } = require('../vscode/src/completion');

const names = mergeNames([collectNames([
  '/**',
  ' * @apiDefine UserAuth Needs a logged user',
  ' */',
  '/**',
  ' * @api {get} /users Get users',
  ' * @apiGroup User',
  ' * @apiVersion 1.2.0',
  ' */',
].join('\n'))]);

/**
 * @param {String} markedText text with a "|" at the cursor
 * @returns {{start: Number, items: Object[]}|undefined}
 */
const completeAt = markedText => {
  const offset = markedText.indexOf('|');
  const text = markedText.replace('|', '');
  const lineBefore = text.slice(0, offset).split('\n').pop();
  return getCompletions({ text, offset, lineBefore, names });
};

const labels = result => result.items.map(item => item.label);

describe('vscode completion', function () {
  it('should offer every tag, replacing the typed @ prefix', function () {
    // ACT
    const result = completeAt('/**\n * @apiP|\n */');

    // ASSERT
    assert.strictEqual(result.start, 3);
    assert.ok(labels(result).includes('@apiParam'));
    assert.ok(labels(result).includes('@apiParamExample'));
    assert.strictEqual(result.items.length, 32);
  });

  it('should continue example tags on the next comment line', function () {
    // ARRANGE
    const result = completeAt('/**\n * @apiSucc|\n */');

    // ACT
    const example = result.items.find(item => item.label === '@apiSuccessExample');

    // ASSERT
    assert.ok(example.insert.includes('\n * '));
    assert.ok(example.isSnippet);
  });

  it('should offer methods after @api {, types after a field tag {, and statuses after (', function () {
    // ACT
    const methods = labels(completeAt('/**\n * @api {|\n */'));
    const types = labels(completeAt('/**\n * @apiBody {St|\n */'));
    const optionalGroupTypes = labels(completeAt('/**\n * @apiSuccess (201 Created) {|\n */'));
    const statuses = completeAt('/**\n * @apiError (40|\n */');

    // ASSERT
    assert.deepStrictEqual(methods.slice(0, 3), ['get', 'post', 'put']);
    assert.ok(types.includes('String[]'));
    assert.ok(optionalGroupTypes.includes('Object'));
    assert.ok(labels(statuses).includes('404 Not Found'));
    assert.strictEqual(statuses.items[0].insert.slice(-1), ')');
  });

  it('should complete @apiUse and @apiPermission with the defines of the project, and groups and versions', function () {
    // ACT
    const use = completeAt('/**\n * @apiUse |\n */');
    const permission = completeAt('/**\n * @apiPermission Us|\n */');
    const group = labels(completeAt('/**\n * @apiGroup |\n */'));
    const version = labels(completeAt('/**\n * @apiVersion |\n */'));

    // ASSERT
    assert.deepStrictEqual(labels(use), ['UserAuth']);
    assert.strictEqual(use.items[0].detail, 'Needs a logged user');
    assert.strictEqual(permission.start, 18);
    assert.deepStrictEqual(group, ['User']);
    assert.deepStrictEqual(version, ['1.2.0']);
  });

  it('should stay silent outside comments and on lines that are not apidoc tags', function () {
    // ACT
    const inCode = completeAt('const a = 1; @api|');
    const afterBlock = completeAt('/**\n * @apiName X\n */\nfunction f () { @apiP| }');
    const prose = completeAt('/**\n * Returns the user @apiP|\n */');

    // ASSERT
    assert.strictEqual(inCode, undefined);
    assert.strictEqual(afterBlock, undefined);
    assert.strictEqual(prose, undefined);
  });

  it('should offer the block snippets outside comments only when asked to', function () {
    // ARRANGE
    const text = 'class User {\n  apid';
    const request = { text, offset: text.length, lineBefore: '  apid', names };

    // ACT
    const without = getCompletions(request);
    const withBlocks = getCompletions(Object.assign({ withBlocks: true }, request));

    // ASSERT
    assert.strictEqual(without, undefined);
    assert.deepStrictEqual(labels(withBlocks), ['apidoc', 'apidocdefine']);
    assert.strictEqual(withBlocks.start, 2);
    assert.ok(withBlocks.items[0].insert.startsWith('/**\n * @api {'));
  });

  it('should treat docstrings and hash comments as comments too', function () {
    // ASSERT
    assert.ok(isInsideComment('def f():\n    """\n    @api', 25));
    assert.ok(!isInsideComment('x = """a"""\ny = 1', 15));
    assert.strictEqual(completionContext('    # @apiG').kind, 'tag');
    assert.strictEqual(completionContext('    # @apiG').start, 6);
  });
});
