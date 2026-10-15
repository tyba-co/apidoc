const vscode = require('vscode');
const { collectNames, getCompletions, mergeNames } = require('./src/completion');

const LANGUAGES = [
  'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue', 'php', 'java', 'go', 'c', 'cpp', 'csharp',
  'dart', 'groovy', 'kotlin', 'scala', 'python', 'ruby', 'perl', 'lua', 'coffeescript', 'elixir', 'erlang', 'clojure',
];
// no snippet contributions for these: VS Code reports an unknown language when their extension is not installed
const BLOCK_LANGUAGES = ['vue', 'kotlin', 'scala'];
const SOURCE_GLOB = '**/*.{js,jsx,ts,tsx,vue,php,java,go,c,cpp,cs,dart,groovy,kt,scala,py,rb,pl,lua,coffee,ex,exs,erl,clj}';
const EXCLUDE_GLOB = '**/{node_modules,.git,dist,build,out,doc,docs}/**';
const MAX_FILES = 3000;
const TRIGGER_CHARACTERS = ['@', '{', '(', ' '];

const namesByFile = new Map();
let indexing;

const decoder = new TextDecoder();

/**
 * @param {vscode.Uri} uri
 */
async function indexFile (uri) {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    namesByFile.set(uri.toString(), collectNames(decoder.decode(bytes)));
  } catch (error) {
    namesByFile.delete(uri.toString());
  }
}

/**
 * @returns {Promise<void>} resolves when every source file of the workspace has been scanned once
 */
function ensureIndex () {
  if (!indexing) {
    indexing = vscode.workspace.findFiles(SOURCE_GLOB, EXCLUDE_GLOB, MAX_FILES)
      .then(files => Promise.all(files.map(indexFile)));
  }
  return indexing;
}

/**
 * @param {vscode.TextDocument} document
 * @returns {Object} names of the whole workspace, using the unsaved text of the open document
 */
function currentNames (document) {
  const perFile = new Map(namesByFile);
  perFile.set(document.uri.toString(), collectNames(document.getText()));
  return mergeNames([...perFile.values()]);
}

const createProvider = withBlocks => ({
  async provideCompletionItems (document, position) {
    const lineBefore = document.lineAt(position.line).text.slice(0, position.character);
    const request = { text: document.getText(), offset: document.offsetAt(position), lineBefore, withBlocks };
    if (!getCompletions(Object.assign({ names: mergeNames([]) }, request))) { return undefined; }

    await ensureIndex();
    const { start, items } = getCompletions(Object.assign({ names: currentNames(document) }, request));
    const range = new vscode.Range(position.line, start, position.line, position.character);
    return items.map((item, index) => {
      const completion = new vscode.CompletionItem(item.label, item.isSnippet ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.EnumMember);
      completion.detail = item.detail;
      completion.range = range;
      completion.insertText = item.isSnippet ? new vscode.SnippetString(item.insert) : item.insert;
      completion.filterText = item.label;
      completion.sortText = String(index).padStart(4, '0');
      return completion;
    });
  },
});

/**
 * @param {vscode.ExtensionContext} context
 */
function activate (context) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(LANGUAGES.filter(language => !BLOCK_LANGUAGES.includes(language)).map(language => ({ language })), createProvider(false), ...TRIGGER_CHARACTERS),
    vscode.languages.registerCompletionItemProvider(BLOCK_LANGUAGES.map(language => ({ language })), createProvider(true), ...TRIGGER_CHARACTERS),
  );

  const watcher = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(indexFile),
    watcher.onDidCreate(indexFile),
    watcher.onDidDelete(uri => namesByFile.delete(uri.toString())),
  );
}

function deactivate () {}

module.exports = { activate, deactivate };
