# Follow-through

A dependency-free static application. All runtime assets live in site/.

- Run `npm run check` for syntax, behavioral tests, seed validation and a static build.
- Run `npm start` for a loopback preview. `PORT` controls the port; `BASE_PATH` can exercise a project-site subpath.
- Keep asset paths relative so the site works under a GitHub Pages repository prefix.
- site/data/journal.json is the canonical append-only record. Derive casefiles and status through site/journal.mjs; do not edit, delete or reorder earlier entries.
- Every public evidence entry needs source IDs, a precise locator, date precision and a bounded factual claim. The journal recording date differs from the historical event date.
- A decision, planned action, documented outcome and proof of causal impact are distinct claims.
- Only reviewed evidence can establish public status. Browser drafts never change the public record.
- Build and tests must work offline from a clean checkout. No source acquisition occurs on a visitor request.
