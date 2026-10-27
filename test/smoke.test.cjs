// Loads the built bundle against a minimal fake `vscode` API and checks it end to end.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const calls = { diagnostics: new Map(), commands: new Map(), listeners: {}, status: null };
const config = { style: 'apa', minWords: null, maxWords: null, requiredHeadings: [],
  checks: ['length', 'references', 'punctuation', 'grammar'], languages: ['markdown', 'plaintext', 'latex'], checkOn: 'type' };

class Position { constructor(line, character) { this.line = line; this.character = character; } }
class Range { constructor(start, end) { this.start = start; this.end = end; } }
class Diagnostic { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }
const on = (name) => (fn) => { calls.listeners[name] = fn; return { dispose() {} }; };

const vscode = {
  Position, Range, Diagnostic,
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 },
  StatusBarAlignment: { Right: 2 }, ViewColumn: { Beside: -2 }, ProgressLocation: { Notification: 15 },
  CodeActionKind: { QuickFix: 'quickfix' },
  CodeAction: class { constructor(title, kind) { this.title = title; this.kind = kind; } },
  WorkspaceEdit: class { replace(uri, range, text) { this.change = { range, text }; } },
  languages: {
    createDiagnosticCollection: () => ({
      set: (uri, items) => calls.diagnostics.set(uri.toString(), items),
      delete: (uri) => calls.diagnostics.delete(uri.toString()), clear: () => calls.diagnostics.clear(), dispose() {},
    }),
    registerCodeActionsProvider: (_s, provider) => { calls.codeActions = provider; return { dispose() {} }; },
  },
  window: {
    activeTextEditor: undefined,
    createStatusBarItem: () => (calls.status = { show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }),
    onDidChangeActiveTextEditor: on('activeEditor'),
  },
  commands: { registerCommand: (id, fn) => { calls.commands.set(id, fn); return { dispose() {} }; } },
  workspace: {
    textDocuments: [],
    getConfiguration: () => ({ get: (k) => config[k] }),
    onDidOpenTextDocument: on('open'), onDidChangeTextDocument: on('change'), onDidSaveTextDocument: on('save'),
    onDidCloseTextDocument: on('close'), onDidChangeConfiguration: on('config'),
  },
};

function fakeDoc(file, languageId) {
  const text = fs.readFileSync(file, 'utf8');
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  return {
    uri: { toString: () => 'file://' + file }, fileName: file, languageId,
    getText: () => text,
    positionAt(offset) {
      let line = 0;
      while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line++;
      return new Position(line, offset - lineStarts[line]);
    },
  };
}

const realLoad = Module._load;
Module._load = function (request, ...rest) { return request === 'vscode' ? vscode : realLoad.call(this, request, ...rest); };
const ext = require('../dist/extension.cjs');

test('bundle activates and registers all commands', () => {
  ext.activate({ subscriptions: [] });
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  for (const c of pkg.contributes.commands) assert.ok(calls.commands.has(c.command), `missing ${c.command}`);
});

test('opening a Markdown draft produces diagnostics, status and quick fixes', async () => {
  const doc = fakeDoc(path.join(__dirname, '..', 'examples', 'sample-essay.md'), 'markdown');
  vscode.window.activeTextEditor = { document: doc };
  calls.listeners.open(doc);
  await new Promise((r) => setTimeout(r, 20));
  const items = calls.diagnostics.get(doc.uri.toString());
  assert.ok(items.length > 0);
  assert.ok(items.every((d) => d.source === 'Plagx'));
  assert.match(calls.status.text, /words · \d+ min/);
  assert.equal(calls.status.visible, true);
  const fixable = items.filter((d) => d.plagxSuggestion != null);
  assert.ok(fixable.length > 0, 'expected at least one quick fix');
  const actions = calls.codeActions.provideCodeActions(doc, null, { diagnostics: fixable });
  assert.equal(actions.length, fixable.length);
});

test('BibTeX files are not draft-checked', async () => {
  const doc = fakeDoc(path.join(__dirname, '..', 'examples', 'sample.bib'), 'bibtex');
  calls.listeners.open(doc);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls.diagnostics.has(doc.uri.toString()), false);
});

test('manual mode skips automatic checks', async () => {
  config.checkOn = 'manual';
  const doc = fakeDoc(path.join(__dirname, '..', 'examples', 'sample-essay.md'), 'plaintext');
  doc.uri = { toString: () => 'untitled:manual' };
  calls.listeners.open(doc);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls.diagnostics.has('untitled:manual'), false);
  config.checkOn = 'type';
});
