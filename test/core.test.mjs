import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftOptions, runDraft, readiness, bibliography, checkBib, bibKeyLine } from '../src/core.js';

const essay = readFileSync(new URL('../examples/sample-essay.md', import.meta.url), 'utf8');
const bib = readFileSync(new URL('../examples/sample.bib', import.meta.url), 'utf8');

test('draftOptions maps settings and drops empty values', () => {
  assert.deepEqual(draftOptions({ style: 'mla', minWords: null, maxWords: 500, checks: [], requiredHeadings: [] }),
    { style: 'mla', maxWords: 500 });
});

test('draft check finds the planted problems', () => {
  const codes = runDraft(essay, { style: 'apa' }).issues.map((i) => i.code);
  for (const c of ['double-space', 'space-before-punctuation', 'repeated-word', 'lowercase-i', 'citation-no-reference']) {
    assert.ok(codes.includes(c), `expected ${c}, got ${codes.join(', ')}`);
  }
});

test('word limits flow through to the core', () => {
  const codes = runDraft(essay, { maxWords: 10 }).issues.map((i) => i.code);
  assert.ok(codes.includes('word-count-high'));
});

test('readiness summarises the result', () => {
  const r = readiness(runDraft(essay, {}));
  assert.equal(typeof r.words, 'number');
  assert.equal(r.ready, r.errors === 0);
  assert.ok(r.minutes >= 1);
});

test('BibTeX formats as an APA reference list', () => {
  const { refs, entries } = bibliography(bib, 'apa');
  assert.equal(refs.length, 4);
  assert.ok(entries.some((e) => e.includes('Smith, J. (2020)')));
});

test('BibTeX check flags duplicates and missing title, with lines', async () => {
  const result = await checkBib(bib);
  const codes = result.issues.map((i) => i.code);
  assert.ok(codes.includes('duplicate'));
  assert.ok(codes.includes('missing-title'));
  const missing = result.issues.find((i) => i.code === 'missing-title');
  assert.equal(missing.line, bibKeyLine(bib, 'notitle'));
  assert.ok(missing.line > 0);
});
