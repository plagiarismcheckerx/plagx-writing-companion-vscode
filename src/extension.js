import * as vscode from 'vscode';
import { formatReference, citeInText, lookupDOI, normalizeDOI } from 'plagx-cite';
import { runDraft, readiness, bibliography, checkBib } from './core.js';

const SOURCE = 'Plagx';
const LEVELS = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

let diagnostics;
let statusItem;
let lastResult = new Map();
const timers = new Map();

function settings() {
  const c = vscode.workspace.getConfiguration('plagx');
  return {
    style: c.get('style'),
    minWords: c.get('minWords'),
    maxWords: c.get('maxWords'),
    requiredHeadings: c.get('requiredHeadings'),
    checks: c.get('checks'),
    languages: c.get('languages'),
    checkOn: c.get('checkOn'),
  };
}

const isBib = (doc) => doc.languageId === 'bibtex' || doc.fileName.toLowerCase().endsWith('.bib');
const isDraft = (doc) => settings().languages.includes(doc.languageId) && !isBib(doc);

function checkDocument(doc) {
  const result = runDraft(doc.getText(), settings());
  const items = result.issues.map((issue) => {
    const start = doc.positionAt(issue.start);
    const end = doc.positionAt(Math.max(issue.end, issue.start + 1));
    const d = new vscode.Diagnostic(new vscode.Range(start, end), issue.message, LEVELS[issue.level]);
    d.source = SOURCE;
    d.code = issue.code;
    if (issue.suggestion != null) d.plagxSuggestion = issue.suggestion;
    return d;
  });
  diagnostics.set(doc.uri, items);
  lastResult.set(doc.uri.toString(), result);
  updateStatus(doc);
  return result;
}

function updateStatus(doc = vscode.window.activeTextEditor?.document) {
  const result = doc && lastResult.get(doc.uri.toString());
  if (!result || !isDraft(doc)) return statusItem.hide();
  const r = readiness(result);
  const icon = r.ready ? (r.warnings ? '$(info)' : '$(check)') : '$(warning)';
  statusItem.text = `${icon} ${r.words.toLocaleString()} words · ${r.minutes} min`;
  statusItem.tooltip = `Plagx: ${r.label}. ${r.errors} errors, ${r.warnings} warnings. Click for details.`;
  statusItem.show();
}

function schedule(doc, delay) {
  const key = doc.uri.toString();
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); checkDocument(doc); }, delay));
}

class QuickFixes {
  provideCodeActions(doc, _range, context) {
    return context.diagnostics
      .filter((d) => d.source === SOURCE && d.plagxSuggestion != null)
      .map((d) => {
        const label = d.plagxSuggestion === '' ? 'Remove' : `Replace with "${d.plagxSuggestion}"`;
        const fix = new vscode.CodeAction(label, vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.replace(doc.uri, d.range, d.plagxSuggestion);
        fix.diagnostics = [d];
        fix.isPreferred = true;
        return fix;
      });
  }
}

async function showReadiness() {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc) return;
  const r = readiness(checkDocument(doc));
  const msg = `${r.label} · ${r.words.toLocaleString()} words · ${r.minutes} min read · ` +
    `Flesch ${r.flesch} · ${r.errors} errors, ${r.warnings} warnings`;
  const pick = await vscode.window.showInformationMessage(msg, 'Show Problems');
  if (pick) vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function formatBib() {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc) return;
  const { style } = settings();
  const { entries } = bibliography(doc.getText(), style);
  if (!entries.length) return vscode.window.showWarningMessage('Plagx: no BibTeX entries found.');
  const heading = style === 'mla' ? 'Works Cited' : 'References';
  const out = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: `# ${heading}\n\n${entries.join('\n\n')}\n`,
  });
  vscode.window.showTextDocument(out, vscode.ViewColumn.Beside);
}

async function checkBibliography() {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc) return;
  const pick = await vscode.window.showQuickPick(
    [
      { label: 'Offline checks', description: 'Duplicates, missing authors, titles, years and invalid DOIs', online: false },
      { label: 'Also verify DOIs online', description: 'Looks each DOI up on Crossref', online: true },
    ],
    { placeHolder: 'Plagx: check BibTeX references' },
  );
  if (!pick) return;
  const source = doc.getText();
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Plagx: checking references…' },
    () => checkBib(source, { checkDOIs: pick.online }),
  );
  diagnostics.set(doc.uri, result.issues.map((issue) => {
    const line = doc.lineAt(issue.line).range;
    const d = new vscode.Diagnostic(line, `${issue.ref}: ${issue.message}`, LEVELS[issue.level]);
    d.source = SOURCE;
    d.code = issue.code;
    return d;
  }));
  vscode.window.showInformationMessage(
    `Plagx: ${result.references} references · ${result.errors} errors · ${result.warnings} warnings`,
  );
}

async function citeDOI() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const input = await vscode.window.showInputBox({
    prompt: 'DOI or doi.org link',
    placeHolder: '10.1037/0003-066X.59.1.29',
    validateInput: (v) => (normalizeDOI(v) ? null : 'Enter a valid DOI'),
  });
  if (!input) return;
  let ref;
  try {
    ref = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Plagx: looking up DOI on Crossref…' },
      () => lookupDOI(normalizeDOI(input)),
    );
  } catch (err) {
    return vscode.window.showErrorMessage(`Plagx: DOI lookup failed. ${err.message}`);
  }
  const { style } = settings();
  const choice = await vscode.window.showQuickPick(
    [
      { label: formatReference(ref, { style }), description: 'Reference list entry' },
      { label: citeInText(ref, { style }), description: 'In-text citation' },
      { label: citeInText(ref, { style, narrative: true }), description: 'Narrative citation' },
    ],
    { placeHolder: `Insert (${style.toUpperCase()})` },
  );
  if (choice) editor.edit((e) => e.replace(editor.selection, choice.label));
}

export function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection('plagx');
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'plagx.showReadiness';

  const auto = (doc, delay) => isDraft(doc) && settings().checkOn !== 'manual' && schedule(doc, delay);

  context.subscriptions.push(
    diagnostics,
    statusItem,
    vscode.commands.registerCommand('plagx.checkDraft', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) checkDocument(doc);
    }),
    vscode.commands.registerCommand('plagx.showReadiness', showReadiness),
    vscode.commands.registerCommand('plagx.formatBibliography', formatBib),
    vscode.commands.registerCommand('plagx.checkBibliography', checkBibliography),
    vscode.commands.registerCommand('plagx.citeDOI', citeDOI),
    vscode.commands.registerCommand('plagx.clear', () => {
      diagnostics.clear();
      lastResult.clear();
      statusItem.hide();
    }),
    vscode.languages.registerCodeActionsProvider({ scheme: '*' }, new QuickFixes(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => auto(doc, 0)),
    vscode.workspace.onDidChangeTextDocument((e) => settings().checkOn === 'type' && auto(e.document, 600)),
    vscode.workspace.onDidSaveTextDocument((doc) => auto(doc, 0)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
      lastResult.delete(doc.uri.toString());
    }),
    vscode.window.onDidChangeActiveTextEditor((ed) => updateStatus(ed?.document)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('plagx')) vscode.workspace.textDocuments.forEach((d) => auto(d, 0));
    }),
  );

  vscode.workspace.textDocuments.forEach((doc) => auto(doc, 0));
}

export function deactivate() {
  timers.forEach(clearTimeout);
}
