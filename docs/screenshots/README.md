# Screenshots

Captured from the production build (`npm run build` and `npm run preview`) in Microsoft Edge at 1440 px wide, using the fictional demonstration data a fresh workspace starts with. The blue banner on each page is the application's own notice that the scenario is fictional.

| File | Page (route) | What it shows |
| --- | --- | --- |
| `01-workspace-summary.png` | Summary (`/`) | Dashboard across all modules: project completeness, stakeholder strategies, process, requirement, story and risk summaries |
| `02-project-overview.png` | Project Overview (`/overview`) | Background, problem statement, objectives, scope and illustrative success criteria |
| `03-stakeholder-analysis.png` | Stakeholders (`/stakeholders`) | Influence-interest grid with derived engagement strategies, and the stakeholder register |
| `04-as-is-process-bottlenecks.png` | AS-IS process (`/processes/prc_demo_as_is`) | Current process steps with owner, input, output, decisions, bottleneck counts and the requirements that trace to each step |
| `05-as-is-to-be-comparison.png` | Process comparison (`/processes/compare`) | AS-IS and TO-BE side by side: change type per step, bottlenecks and improvements |
| `06-requirements-register.png` | Requirements (`/requirements`) | Functional and non-functional requirements with MoSCoW priority, status, filters and story counts |
| `07-traceability-matrix.png` | Traceability Matrix (`/traceability`) | Requirement → stakeholder → objectives → AS-IS and TO-BE steps → user stories, with gap totals |
| `08-user-story-acceptance-criteria.png` | User story US-006 (`/user-stories/us_demo_006`) | Story statement, Given/When/Then acceptance criteria with recorded verification outcomes, linked requirements |
| `09-story-coverage.png` | Story Coverage (`/coverage`) | Which requirements have user stories, reported separately from acceptance-criteria verification |
| `10-risk-register.png` | Risk Register (`/risks`) | Risks with derived score and severity, response, owner and status |
| `11-risk-matrix.png` | Risk Matrix (`/risk-matrix?p=4&i=5`) | 5 × 5 probability-impact matrix with the selected cell's risks listed |

## Recapturing

To refresh the images after changes:

1. Run `npm run build`, then `npm run preview`.
2. Open the address it prints in a new browser profile or private window, so the demonstration data is seeded fresh.
3. Set the window to 1440 px wide and capture each route in the table above, keeping the same file names.

Optional extras: the mobile layout at 390 px wide (for example the requirements register), the requirement detail page for FR-007, and the Workspace data page.
