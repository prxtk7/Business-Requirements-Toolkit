# Architecture

The toolkit is a client-side single-page application. There is no backend: all data lives in one workspace object that is kept in the browser's `localStorage`.

## Layers

```
src/
  domain/      Types and business rules: validation, identifiers, traceability,
               coverage, risk scoring, integrity checks. Plain TypeScript, no React.
  data/        The fictional Northstar HVAC Services demonstration dataset.
  storage/     Versioned localStorage persistence: load, save, schema migration,
               backup and recovery, cross-tab change detection.
  state/       Pure reducer and the WorkspaceProvider that validates, applies and
               saves every change.
  components/  Layout (app shell, navigation, notices, error and loading states)
               and reusable UI primitives (form fields, dialogs, badges, panels).
  features/    One folder per module: overview, stakeholders, processes,
               requirements, stories, risks, workspace.
  hooks/       Form state, unsaved-changes guard, commit feedback, document title.
  app/         Route table, providers, navigation configuration.
  test/        Test helpers: in-memory storage and a full-application renderer.
```

Dependencies point one way: `features` → `state` → `domain`. Business rules (what is valid, what may be deleted, how a score or strategy is derived) live in `domain/` and are unit-tested without rendering anything. Pages call domain functions; they do not contain rules of their own.

## State management

The whole project is a single aggregate, the `Workspace`: project overview, stakeholders, processes (with nested steps), bottlenecks, improvements, requirements, user stories (with nested acceptance criteria), risks, and the counters used to issue identifiers.

- `workspaceReducer` is a pure function from `(workspace, action)` to a new workspace. It also refuses changes that would break a relationship, as a second line of defence.
- `WorkspaceProvider` exposes typed actions (`saveRequirement`, `deleteStakeholder`, …). Each action re-validates the input against the latest committed state, applies the reducer, removes risk links to records that no longer exist, and saves synchronously. It returns whether the change was saved, so forms stay open with an explanation when it was not.
- React context distributes the workspace; there is no external state library.

### Derived, never stored

Values that depend on other values are calculated when needed, so they cannot drift out of sync:

- stakeholder engagement strategy (influence × interest, nine-cell mapping);
- user story statement ("As a … I want … so that …");
- risk score (probability × impact) and severity band;
- traceability gaps and coverage figures.

### Identifiers

`FR-001`, `NFR-001`, `US-001` and `RSK-001` come from per-family counters stored in the workspace. The next number is the higher of the counter and the highest identifier in use, so an identifier is never reissued after a deletion. Acceptance criteria are numbered per story (`AC-1`, `AC-2`, …) in the same way.

## Relationship rules

Records reference each other by stable ids. Deleting a record follows one of three rules:

| Situation | Rule |
| --- | --- |
| A record owns others (a process owns its steps; a step owns its bottlenecks and improvements) | Deleted together, after a confirmation that lists what goes with it |
| Another record depends on it (a stakeholder who is a requirement source, step owner, user role or risk owner; a step or objective a requirement traces to; a requirement a story implements; an AS-IS process used as a TO-BE baseline) | Deletion is blocked until the reference is removed or reassigned |
| Context links (a requirement's dependencies; a risk's related records) | The link is removed and the other record is kept; the delete dialog names what is affected |

## Storage and data safety

Data is saved as an envelope: `{ schemaVersion, savedAt, workspace }`.

- **Schema migration.** The current schema is version 5. Older data is upgraded step by step on load (v1 → v2 → v3 → v4 → v5). Each step only adds structure, is idempotent and never resets a counter.
- **Validation on load.** Stored data is checked with hand-written type guards (no schema library).
- **Integrity checks on load.** Links to records that no longer exist are removed. Problems that cannot be fixed without guessing (for example a risk owner who no longer exists, or a circular requirement dependency) are kept and reported. Malformed individual records are set aside instead of discarding the whole workspace.
- **Backups.** Before anything unreadable or repaired is overwritten, the original stored text is copied to a backup key (`ba-toolkit:workspace-backup:<timestamp>`). If that backup cannot be written, for example because storage is full, the original is left untouched. A notice explains what happened in each case.
- **Several tabs.** Tabs are not synchronised. A tab detects when another tab has changed the stored data, stops saving and asks the user to reload, so it cannot overwrite newer data with a stale copy.

## Routing and loading

React Router defines one route per page (for example `/requirements/:requirementId`, `/traceability`, `/risk-matrix`). The layout, workspace state, storage and demo data load first. Each feature's pages are loaded the first time the feature is opened (`React.lazy` with `Suspense`), producing one file per feature. If a page fails to download or render, an error message with a reload option appears inside the layout and navigation keeps working.

Production build (approximate sizes, minified): framework code about 317 kB, application core about 130 kB (it carries the demonstration data), shared UI about 64 kB, and 8–40 kB per feature.

## Accessibility

- Every form field has a visible label. Validation errors are linked to their fields and summarised at the top of the form, which receives focus after a failed submit.
- The mobile navigation behaves as a modal dialog: focus moves into it, Tab stays inside it, and Escape or the backdrop closes it and returns focus to the menu button.
- Wide tables sit in named, keyboard-focusable scroll regions.
- The risk matrix and stakeholder grid have text alternatives for their visual layout. Colour is never the only carrier of meaning.

## Quality checks

| Command | What it checks |
| --- | --- |
| `npm test` | 365 automated tests (Vitest and Testing Library): domain rules, storage and migrations, reducer, and full-application integration tests that click through every module |
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | oxlint with the React Hooks, React Refresh, jsx-a11y and TypeScript rule sets |
| `npm run build` | Type check, then production build |

oxlint is used instead of ESLint because typescript-eslint relies on TypeScript's JavaScript API, which the TypeScript 7 native compiler used here does not provide. Rule exceptions are explained in `.oxlintrc.json` and next to each inline exception.

## Dependencies

Runtime: React, React DOM, React Router and Lucide icons. Everything else is a development tool. Versions are pinned exactly in `package.json` and recorded in `package-lock.json`; use `npm ci` for a reproducible install.
