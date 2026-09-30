# Follow-through

An independent, static application for tracing public decisions through later actions and documented outcomes. Its source of truth is an **append-only evidence journal**. The interface rebuilds casefiles, status, search and downloadable briefs from that journal. Visitors can replay each case one entry at a time and inspect every cited public record.

The initial collection contains four Manhattan street-safety cases: Amsterdam Avenue, Chrystie Street, Columbus Avenue and St. Marks Place. Three have documented outcomes; St. Marks remains unresolved in this corpus. The application model is not tied to a street, a community board, a vote tally or one agency. A fictional library-hours case in the test suite proves the same workflow with a different domain and a decision without a vote.

## Run locally

Requires Node.js 22 or newer. No third-party runtime or build dependencies.

    npm ci --ignore-scripts
    npm run check
    PORT=4173 BASE_PATH=/cb-follow-through/ npm start

Open http://127.0.0.1:4173/cb-follow-through/.

## How the journal works

The canonical data file is site/data/journal.json. It contains one ordered entries array. Each entry has a contiguous sequence, the date it entered this dataset, a kind, and a payload. Case openings, cited source additions, decisions, actions, outcomes, requirements and fulfillment assessments are separate entries. Replaying through sequence N rebuilds only the information admitted by N. The dates of historical decisions or actions live inside evidence payloads; they are **not** the journal entry date. The seed's sources were reviewed September 29, 2026, and the initial journal was assembled September 30.

Corrections, retractions and case withdrawals are additional journal entries; they never overwrite the record they repair. A corrected requirement returns to unknown until it is assessed again, while a retracted claim or requirement disappears only from the current casefile and remains visible in replay and the audit trail. A withdrawn case remains visible and is labeled separately from documented or unknown outcomes. A CI check compares the journal to the relevant Git base and rejects edits, deletions or reordering of prior entries. Manual publication also compares it with the currently published journal; only the first publication from a clean root commit can start without that baseline. Normal Git history provides an additional audit trail; this static demo does not claim tamper-proof storage. See [evidence and acceptance](docs/methodology.md) for the repair semantics.

The public read model is computed in site/journal.mjs. Outcome status requires reviewed outcome evidence. A decision or planned action cannot produce a documented outcome, and a documented outcome does not automatically fulfill every requirement. Browser-local notes are unreviewed and remain outside the public journal.

To add another kind of public case, append a cited source_added entry, a case_opened entry with decision_maker, implementer, subject and domain, then the relevant evidence_added and requirement entries. A decision can say “Approved by trustees” with a written basis instead of a vote tally; place is optional. Give every entry its next sequence and actual dataset recording date. Keep historical event dates and precision inside the evidence payload. Run npm run check, inspect the new case in the browser, and verify its original source links. See [evidence and acceptance](docs/methodology.md).

## Static deployment

npm run build validates the journal and copies only site/ into dist/. All asset paths are relative and work under a GitHub Pages repository prefix. The public application is at https://bottomry.github.io/cb-follow-through/. The Publish Pages workflow deploys from main on manual dispatch; ordinary pushes run checks only.

Application code: MIT. See [NOTICE](NOTICE.md) for source attribution. Original public records remain the authority; application licensing does not claim ownership of those records.
