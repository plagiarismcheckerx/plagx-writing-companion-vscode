// Runs inside a real VS Code instance (see "npm run test:vscode"); writes results to a JSON file.
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('[plagx-test] loaded');
exports.run = async function run() {
  console.log('[plagx-test] run start');
  const root = path.resolve(__dirname, '..', '..');
  const out = { ok: false, checks: {} };
  try {
    const essay = vscode.Uri.file(path.join(root, 'examples', 'sample-essay.md'));
    const doc = await vscode.workspace.openTextDocument(essay);
    await vscode.window.showTextDocument(doc);
    await wait(2500);
    const diags = vscode.languages.getDiagnostics(essay).filter((d) => d.source === 'Plagx');
    out.checks.diagnostics = diags.length;
    out.checks.codes = [...new Set(diags.map((d) => String(d.code)))];

    const target = diags.find((d) => d.code === 'repeated-word') || diags[0];
    const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', essay, target.range);
    out.checks.quickFixes = (actions || []).filter((a) => a.title && /Replace|Remove/.test(a.title)).map((a) => a.title);

    const commands = await vscode.commands.getCommands(true);
    out.checks.commands = commands.filter((c) => c.startsWith('plagx.'));

    const bib = vscode.Uri.file(path.join(root, 'examples', 'sample.bib'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(bib));
    await vscode.commands.executeCommand('plagx.formatBibliography');
    await wait(1500);
    const formatted = vscode.window.visibleTextEditors.map((e) => e.document).find((d) => d.isUntitled);
    out.checks.bibliography = formatted ? formatted.getText().split('\n').slice(0, 3) : null;

    out.ok = diags.length > 0 && out.checks.commands.length === 6 && !!formatted;
  } catch (err) {
    out.error = String(err && err.stack || err);
  }
  console.log('[plagx-test] result ' + JSON.stringify(out));
  fs.writeFileSync(path.join(root, 'test', 'integration', 'result.json'), JSON.stringify(out, null, 2));
};
