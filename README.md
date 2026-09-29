# Follow-through

A standalone, source-linked explorer for community-board decisions and agency outcomes. Four Manhattan street-safety casefiles connect recorded votes to agency actions, preserve gaps, and make original records inspectable.

## Run locally

Requires Node.js 22 or newer. No third-party runtime or build dependencies.

```sh
npm ci --ignore-scripts
npm run check
npm start
```

Open `http://127.0.0.1:4173/`. To simulate a GitHub Pages project site:

```sh
PORT=4173 BASE_PATH=/cb-follow-through/ npm start
```

Open `http://127.0.0.1:4173/cb-follow-through/`.

## The seed

| Case | Board | Evidence chain |
|---|---|---|
| Amsterdam Avenue | Manhattan CB7 | February 2016 resolution → DOT design → December 2016 completion announcement |
| Chrystie Street | Manhattan CB3 | March 2016 design → May 2016 final support → December 2016 completion announcement |
| Columbus Avenue | Manhattan CB7 | June 2010 vote → partial installation update → later DOT confirmation of the 2010 project |
| St. Marks Place | Manhattan CB3 | May 2026 decision inherited from a reviewed public pilot; outcome unknown |

The first three are end-to-end evidence histories, not assertions that a board vote caused construction. The fourth demonstrates the missing-evidence state. The small curated sample is not a citywide performance measure. See [methodology](docs/methodology.md) and the in-app source register.

Search, evidence-status filters, case permalinks, source excerpts, a request/outcome matrix, browser-local draft notes and downloadable text briefs all work without an account. Exported briefs include source URLs and separate unreviewed notes. No analytics, AI calls, CityScroll services or remote datasets are needed at runtime.

## Static deployment

`npm run build` validates the corpus and copies only `site/` into `dist/`. All asset and dataset paths are relative. Host `dist/` with any static server.

The repository is currently private; public deployment requires a separate approval. The **Publish Pages** workflow is manual and refuses to run on a private repository or a branch other than `main`. After approval, complete the repository's public-release review, make it public, select GitHub Actions as the Pages source in repository settings, and dispatch **Publish Pages** from `main`. Ordinary pushes run checks only and cannot publish the site.

## Extend the corpus

Edit `site/data/cases.json` with new source records and cases. Cite the exact motion, date, vote, scope and document location. Keep plans separate from confirmed implementation. Preserve temporal precision, retrospective statements and unavailable sources. Run `npm run check`; then inspect the new case and every source link in the browser. Candidate evidence belongs in unreviewed local notes until reviewed.

Application code: MIT. See [NOTICE](NOTICE.md) for source attribution. Original public records remain the authority; application licensing does not claim ownership of those records.
