const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

const fixture = path.resolve(__dirname, '..', 'fixtures', 'workspace', 'users.js');

/**
 * @param {vscode.TextDocument} document
 * @param {String} lineText exact text of the line, the cursor goes at its end
 * @returns {vscode.Position}
 */
const endOfLine = (document, lineText) => {
  const line = document.getText().split('\n').findIndex(text => text === lineText);
  assert.ok(line >= 0, `fixture line not found: "${lineText}"`);
  return new vscode.Position(line, lineText.length);
};

const completionsAt = async (document, position) => {
  const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
  return list.items;
};

describe('apidoc completion in a real VS Code', function () {
  let document;
  let editor;

  before(async function () {
    document = await vscode.workspace.openTextDocument(fixture);
    editor = await vscode.window.showTextDocument(document);
    await vscode.extensions.getExtension('tyba-co.apidoc-vscode').activate();
  });

  it('contributes snippets only to languages this VS Code knows (no Unknown language errors)', async function () {
    // ARRANGE
    const known = new Set(await vscode.languages.getLanguages());
    const manifest = vscode.extensions.getExtension('tyba-co.apidoc-vscode').packageJSON;

    // ACT
    const unknownLanguages = [...new Set(manifest.contributes.snippets.map(entry => entry.language))].filter(language => !known.has(language));

    // ASSERT
    assert.deepStrictEqual(unknownLanguages, []);
  });

  it('activates and offers every tag after @ inside a doc comment', async function () {
    // ACT
    const items = await completionsAt(document, endOfLine(document, ' * @apiP'));
    const labels = items.map(item => (typeof item.label === 'string' ? item.label : item.label.label));

    // ASSERT
    assert.ok(labels.includes('@apiParam'));
    assert.ok(labels.includes('@apiParamExample'));
    assert.ok(labels.includes('@apiBody'));
  });

  it('replaces the typed @apiP so accepting does not double the @', async function () {
    // ARRANGE
    const position = endOfLine(document, ' * @apiP');
    const items = await completionsAt(document, position);
    const item = items.find(candidate => candidate.label === '@apiParam');

    // ACT
    await editor.edit(edit => edit.delete(item.range));
    await editor.insertSnippet(item.insertText, item.range.start);
    const line = document.lineAt(position.line).text;
    await vscode.commands.executeCommand('undo');
    await vscode.commands.executeCommand('undo');

    // ASSERT
    assert.strictEqual(item.range.start.character, 3);
    assert.strictEqual(line, ' * @apiParam {String} field Description');
  });

  it('completes @apiUse with the @apiDefine of another file of the workspace', async function () {
    // ACT
    const items = await completionsAt(document, endOfLine(document, ' * @apiUse '));
    const use = items.find(item => item.label === 'UserAuth');

    // ASSERT
    assert.ok(use, 'UserAuth from auth.js is offered');
    assert.strictEqual(use.detail, 'Needs a logged user');
  });

  it('offers types in braces and the groups already used', async function () {
    // ACT
    const types = (await completionsAt(document, endOfLine(document, ' * @apiBody {St'))).map(item => item.label);
    const groups = (await completionsAt(document, endOfLine(document, ' * @apiGroup '))).map(item => item.label);

    // ASSERT
    assert.ok(types.includes('String[]'));
    assert.ok(groups.includes('User'));
  });

  it('offers tags in a whole-line comment and nothing in plain code', async function () {
    // ACT
    const lineCommentLabels = (await completionsAt(document, endOfLine(document, '// @apiP'))).map(item => item.label);
    const inCode = (await completionsAt(document, endOfLine(document, 'const insideCode = 2;'))).map(item => item.label);

    // ASSERT
    assert.ok(lineCommentLabels.includes('@apiParam'));
    assert.ok(!inCode.includes('@apiParam'));
  });
});
