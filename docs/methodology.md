# Evidence and acceptance

The unit is a **casefile**: a bounded public decision and its later actions and outcomes, connected by reviewed subject, actor and scope. The initial collection uses named street corridors, but the model also admits other public services, policies and projects. A matching name alone is insufficient.

The canonical data is an append-only journal. A casefile is a read model rebuilt from the journal, not a separately maintained record. Each entry has a contiguous sequence and a dataset recording date. Historical event dates live inside cited evidence entries. Replay moves through the dataset's entry sequence; because the initial corpus was assembled together, replay does **not** claim to show what residents knew on each historical date. The initial source review date is September 29, 2026; journal assembly was September 30.

Corrections append replacement evidence, source or case updates with a reason. Earlier entries remain available in replay. Requirements have their own assessments, so the main outcome can be documented while an attached condition stays unknown. A CI check rejects changes to the earlier journal prefix.

Three seed cases contain the full chain: a recorded board decision, a dated agency action, and explicit implementation evidence. A proposal or planned start does not satisfy an outcome. An outcome record closes only the supported part of a requirement. St. Marks intentionally lacks a later agency or outcome record.

Dates describe records. Columbus's December 2012 presentation retrospectively confirms the original 2010 installation; the date does not imply construction finished in 2012. DOT's December 21, 2016 announcement confirms Amsterdam and Chrystie, but supplies no exact completion day. Chrystie's initial February 2015 request is retrospective and retains month precision.

Voting context matters. Amsterdam uses the full-board tally, not its separate committee vote. Chrystie's item 3 is covered by the omnibus tally excluding only item 6. Columbus's final motion includes an accepted friendly amendment requiring evaluation after six months and publication of results to CB7 and the community. A later, stronger amendment seeking CB7 control over whether to revisit, end, expand, modify or make the lane permanent failed and is not treated as adopted. The October 2011 return presentation establishes follow-up, but does not by itself establish timely compliance with the six-month condition or publication to the community. St. Marks uses its item-specific vote, not the separate omnibus motion.

## Coverage and review

Four deliberately selected Manhattan street-safety cases, two community boards, one agency. Sources were reviewed September 29, 2026 through official published document text, except the inherited St. Marks seed. Direct binary PDF requests were unavailable during assembly; no original-file hash or fresh PDF download is asserted. The in-app register provides locators, excerpts and direct links. This is a dated snapshot, not live monitoring.

No causal attribution, independent field audit, current-condition claim or representative performance statistic is established. Missing evidence means unknown within this corpus, not agency inaction. No personal constituent data is included.

## Functional acceptance

- Open each of the three completed casefiles and inspect a decision, agency action and implementation source.
- Replay Amsterdam from its opening to its documented outcome, then to the still-unknown task-force requirement. Check that each step changes only after its journal entry.
- Replay a correction in a test fixture and confirm the earlier interpretation remains recoverable. Add a fictional non-street decision without a vote and confirm the same projection works.
- Try changing an existing journal entry on a feature branch and confirm the append-only check rejects it.
- Open St. Marks and see missing action/outcome evidence, inherited-source disclosure and a follow-up question.
- Inspect the unfulfilled Amsterdam task-force request without losing the documented lane result.
- Search a street or board, combine an evidence filter, and recover from an empty result.
- Open and close source dialogs by mouse and keyboard. Follow a case permalink.
- Write a local note, reload, export the brief, and confirm the reviewed status does not change. Clear the test note.
- Run beneath `/cb-follow-through/`, resize to mobile, and confirm no horizontal page overflow.
- Build from a clean checkout; serve only the static artifact; no sibling repository or network data service is required.

Automated tests exercise corpus integrity, completion semantics, query/filter behavior, source URL handling, draft export separation, temporal precision and project-path serving. Browser checks cover the interactions and layout.
