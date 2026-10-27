// Editor-independent glue between VS Code settings and the Plagx Cite / Preflight cores.
import { checkDraft } from 'plagx-preflight';
import { parseBibTeX, formatBibliography, checkReferences } from 'plagx-cite';

/** Turns extension settings into plagx-preflight options. */
export function draftOptions(settings = {}) {
  const options = { style: settings.style || 'apa' };
  if (Number.isFinite(settings.minWords)) options.minWords = settings.minWords;
  if (Number.isFinite(settings.maxWords)) options.maxWords = settings.maxWords;
  if (Array.isArray(settings.checks) && settings.checks.length) options.checks = settings.checks;
  if (Array.isArray(settings.requiredHeadings) && settings.requiredHeadings.length) {
    options.requiredHeadings = settings.requiredHeadings;
  }
  return options;
}

export function runDraft(text, settings) {
  return checkDraft(text, draftOptions(settings));
}

/** Writing readiness: ready when there are no errors; warnings are listed but don't block. */
export function readiness(result) {
  const { stats, errors, warnings, infos } = result;
  const ready = errors === 0;
  return {
    ready,
    label: ready ? (warnings ? 'Ready with suggestions' : 'Ready') : 'Not ready',
    words: stats.words,
    minutes: Math.max(1, Math.round(stats.readingTimeMinutes)),
    errors,
    warnings,
    infos,
    flesch: Math.round(stats.fleschReadingEase),
  };
}

export function bibliography(source, style = 'apa') {
  const refs = parseBibTeX(source);
  return { refs, entries: formatBibliography(refs, { style, format: 'text' }) };
}

/** Finds the line where a BibTeX entry key is defined, so issues can point at it. */
export function bibKeyLine(source, key) {
  if (!key || key.startsWith('#')) return 0;
  const lines = source.split(/\r?\n/);
  const re = new RegExp(`^\\s*@\\w+\\s*\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`);
  const i = lines.findIndex((l) => re.test(l));
  return i < 0 ? 0 : i;
}

export async function checkBib(source, { checkDOIs = false, fetch } = {}) {
  const refs = parseBibTeX(source);
  const result = await checkReferences(refs, { checkDOIs, fetch });
  return {
    ...result,
    issues: result.issues.map((issue) => ({ ...issue, line: bibKeyLine(source, issue.ref) })),
  };
}
