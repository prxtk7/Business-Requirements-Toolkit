# Limitations

The toolkit is a portfolio project that demonstrates business analysis work. This page separates what is implemented from what is not, so the scope is clear.

## What the toolkit is, and is not

| The toolkit does | The toolkit does not |
| --- | --- |
| Record and link the analysis for a proposed Field Service Management system: project charter, stakeholders, processes, requirements, user stories, acceptance criteria and risks | Dispatch technicians, take service requests, manage stock, send notifications or execute work orders. Those are capabilities of the *proposed* FSM system described in the analysis |
| Show traceability gaps and story coverage | Generate requirements, stories or risk ratings automatically |
| Record a verification outcome (Passed, Failed, Blocked, Not Tested) for each acceptance criterion | Run tests against any system |
| Ship with a fictional demonstration scenario | Contain real company data, user research or measured results |

## Functional limitations

- **One project per workspace.** Starting a blank workspace or restoring the demo replaces the current one.
- **No reporting or export.** There is no PDF, Word, Excel or CSV export and no printable report. "Analysis export" is listed as a planned toolkit feature in the navigation and is not implemented. It should not be confused with the management reports that the fictional FSM requirements describe (FR-010, FR-013).
- **No import.** Requirements or stories cannot be imported from other tools.
- **No version history or audit trail.** Records show created and last-updated times only; earlier versions are not kept.
- **No comments, approvals or sign-off workflow.** Status fields (for example *Approved*) are set by the user; no approval process stands behind them.
- **Process modelling is step-based.** Processes are ordered lists of steps with decisions noted in text. There is no BPMN diagram editor or notation.
- **Fixed scales.** Influence and interest are three-level ratings; risk probability and impact are 1–5. Neither scale can be configured.

## Data and storage

- **Single browser.** Data is stored in the browser's `localStorage` on one device. It is not synchronised across devices or users, and clearing site data deletes it.
- **No accounts or access control.** Anyone using the browser profile can see and change the workspace.
- **Storage size.** `localStorage` is typically limited to about 5 MB per site. That is ample for one project, but not designed for very large datasets.
- **Multiple tabs.** Changes are not shared between open tabs. A tab detects that another tab has saved, stops saving and asks the user to reload, rather than merging changes.
- **Repairs on load are automatic.** If stored data contains broken links or malformed records, the toolkit repairs or sets them aside, backs up the original and explains what it did. There is no in-app screen to browse or restore those backups; they are kept in `localStorage` under `ba-toolkit:workspace-backup:<timestamp>` and accumulate until removed manually.

## Technical scope

- **Client-side only.** No backend, API or database.
- **Browser testing.** Automated tests run in jsdom. Manual and scripted checks used Microsoft Edge (Chromium) at desktop (1440 px) and mobile (390 px) widths. Firefox, Safari and real mobile devices have not been tested.
- **Accessibility.** Keyboard navigation, focus handling, labelling and semantic markup were checked in code, in automated tests and in a browser. No formal audit was carried out and no screen reader was used for testing.
- **Integration test timing.** The forms are fully controlled, so in jsdom every keystroke re-renders the form under test. Integration tests therefore paste long text (one input event per field) and type only short values. The slowest form tests take about 2–3 seconds each on their own and up to about 9 seconds when the whole suite runs in parallel on a 12-core machine, against a 20-second per-test timeout. Headroom on slower or heavily loaded machines has not been measured.
- **Linting.** oxlint is used because ESLint's TypeScript parser does not support the TypeScript 7 native compiler. oxlint has no type-aware rules.
- **Language.** The interface is in English (en-GB) only.

## Demonstration data

- Northstar HVAC Services and every person, customer and figure are fictional.
- Numeric targets are labelled illustrative. They are planning goals, not results.
- Some requirements deliberately lack links, so that the traceability matrix and coverage report have gaps to show.
- The scope decisions in [business-case.md](business-case.md#scope-decisions) were made by the author for the fictional scenario. They do not represent stakeholder approval, and the retention requirement (NFR-009) deliberately states no period because that would need legal and organisational confirmation in a real project.
- The few verification outcomes on acceptance criteria are fictional pilot-review records.
