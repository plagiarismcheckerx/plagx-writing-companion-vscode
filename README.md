# Plagx Writing Companion for VS Code

**Free academic writing checks inside VS Code.** Plagx Writing Companion checks essays, theses and papers written in Markdown, plain text or LaTeX: citations and reference lists, BibTeX files, word limits, basic grammar and punctuation, and overall writing readiness.

By Plagiarism Checker X. For full plagiarism checks and AI-generated text detection, visit [Text Similarity Detector](https://plagiarismcheckerx.com/?utm_source=plagx-vscode). This free extension does not detect plagiarism or AI-generated text.

---

## Features

### Draft checks as you type
Open any `.md`, `.txt` or `.tex` file and suggestions appear as underlines and in the **Problems** panel:

- **Citations and references:** in-text citations with no matching reference entry, references that are never cited, a missing reference section, and *et al.* formatting (APA or MLA)
- **Word limits:** warnings when the draft goes over or under your minimum and maximum word counts (the reference list isn't counted)
- **Punctuation:** double spaces, spaces before punctuation, missing spaces after punctuation, repeated punctuation, unmatched brackets and quotes, mixed quote styles
- **Basic grammar:** repeated words, *a/an* mistakes, lowercase *i*, sentence capitals, commonly confused words
- **Structure:** long sentences, long or single-sentence paragraphs, and required headings
- **Passive voice** (optional)

Many suggestions have a **quick fix**: click the lightbulb or press `Ctrl+.` / `Cmd+.`.

### Writing readiness
The status bar shows the word count and reading time of the open draft. Click it to see the readiness summary: **Ready**, **Ready with suggestions** or **Not ready**, with the Flesch Reading Ease score and the error and warning counts.

### Citations and bibliography
- **Format BibTeX as Reference List:** turns a `.bib` file into an APA reference list or MLA Works Cited page
- **Check BibTeX References:** finds duplicate entries, missing authors, titles and years, and invalid DOIs. Optionally verifies each DOI online.
- **Insert Reference from DOI:** enter a DOI and insert the formatted reference, an in-text citation or a narrative citation

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **Plagx**:

| Command | What it does |
|---|---|
| Plagx: Check Draft | Checks the current file now |
| Plagx: Show Writing Readiness | Readiness summary, word count, reading time and readability |
| Plagx: Format BibTeX as Reference List | Opens a formatted APA or MLA list beside a `.bib` file |
| Plagx: Check BibTeX References | Finds problems in a `.bib` file |
| Plagx: Insert Reference from DOI | Looks up a DOI and inserts a reference or citation |
| Plagx: Clear Suggestions | Removes all Plagx underlines |

## Settings

| Setting | Default | Description |
|---|---|---|
| `plagx.style` | `apa` | Citation style: `apa` or `mla` |
| `plagx.minWords` | *(none)* | Minimum word count |
| `plagx.maxWords` | *(none)* | Maximum word count |
| `plagx.requiredHeadings` | `[]` | Headings the draft must contain, e.g. `["Introduction", "Conclusion"]` |
| `plagx.checks` | all except passive voice | Check groups: `length`, `references`, `punctuation`, `grammar`, `passive-voice` |
| `plagx.languages` | `markdown`, `plaintext`, `latex` | File types checked automatically |
| `plagx.checkOn` | `type` | `type`, `save` or `manual` |

Example `settings.json` for a 2,000–2,500 word APA essay:

```json
{
  "plagx.style": "apa",
  "plagx.minWords": 2000,
  "plagx.maxWords": 2500,
  "plagx.requiredHeadings": ["Introduction", "Conclusion"]
}
```

## Privacy

All draft and BibTeX checks run locally inside VS Code. Your text is never uploaded. The extension connects to the internet only when you ask it to: **Insert Reference from DOI** and the optional online DOI check send the DOI to the public [Crossref API](https://www.crossref.org/). No accounts, API keys or telemetry are used.

## How it works

The extension is a thin VS Code layer over two open-source Plagx libraries, so the checks match the other Plagx tools exactly:

- [plagx-preflight](https://www.npmjs.com/package/plagx-preflight): draft checks, word counts, citation matching, grammar and punctuation
- [plagx-cite](https://www.npmjs.com/package/plagx-cite): APA and MLA formatting, BibTeX, DOI lookup and duplicate detection

Suggestions are rule-based. Always check them against your institution's style guide.

## What this extension does not do

Plagx Writing Companion gives writing suggestions only. It does **not** check for plagiarism or detect AI-generated text. For full document checks, use [Plagiarism Checker X](https://plagiarismcheckerx.com/?utm_source=plagx-vscode) or [download it](https://plagiarismcheckerx.com/download?utm_source=plagx-vscode) for desktop.

## License

[MIT](LICENSE) © 2026 Plagiarism Checker X
