# Requirements workflow

This page explains how the toolkit's records connect, from the people affected by the change to the risks that threaten it. Examples use the fictional Northstar HVAC Services demo data.

## The chain

```
Stakeholders ──► Objectives
     │               │
     ▼               ▼
AS-IS process ──► Bottlenecks          (what goes wrong today)
     │
     ▼
TO-BE process ──► Improvements         (the intended way of working)
     │
     ▼
Requirements (FR / NFR, MoSCoW) ──► dependencies between requirements
     │
     ▼
User stories ──► Acceptance criteria (Given / When / Then) ──► verification status
     │
     ▼
Risks (linked to any of the records above; owned by a stakeholder)
```

| Record | What it captures | How it links |
| --- | --- | --- |
| Stakeholder | Role, interest, influence, expectations; engagement strategy is derived | Source of requirements, responsible for process steps, user role of stories, owner of risks |
| Objective | What the project must achieve | Requirements trace to one or more objectives |
| AS-IS process | Current steps with owner, input, output and decisions | Bottlenecks are recorded against steps |
| TO-BE process | Future steps, each marked unchanged, modified, new or automated | Linked step by step to its AS-IS baseline; improvements are recorded against steps |
| Requirement | Functional (`FR`) or non-functional (`NFR`), category, rationale, MoSCoW priority, status | Traces to a source stakeholder, objectives, AS-IS and TO-BE steps, and other requirements it depends on |
| User story | Role, need and benefit; priority and status set independently | Implements one or more requirements |
| Acceptance criterion | Given / When / Then, plus a recorded verification outcome | Belongs to one story |
| Risk | Probability and impact (1–5), derived score and severity, response, mitigation, contingency, owner, status | Owned by a stakeholder (or a named external party); optionally linked to stakeholders, objectives, steps, requirements and stories |

## Prioritisation with MoSCoW

Each requirement and each story has a priority: **Must**, **Should**, **Could** or **Won't (this time)**. In the demo, the 27 requirements are 10 Must, 14 Should, 2 Could and 1 Won't: FR-018 *Live technician location tracking* is recorded as a Won't Have with status Deferred, so the excluded request stays visible and can be reconsidered later. A story's priority is set on its own, because a "Must" requirement can contain stories of different urgency.

Statuses follow one rule in the demo: a story is not marked Approved, Ready or Implemented while a requirement it implements is still Draft, Proposed or Under Review. For that reason US-005 and US-006 are Under Review: their requirements FR-005 and FR-006 are still Proposed. Their acceptance criteria can still carry fictional pilot-review outcomes, because a pilot can inform a requirement before it is approved.

## Traceability and gaps

The **traceability matrix** shows, for every requirement, its source stakeholder, objectives, AS-IS steps, TO-BE steps and user stories. Missing links are reported as gaps; none are filled in automatically. The demo deliberately contains gaps so the matrix has something to show:

| Check | Demo result |
| --- | --- |
| Fully traced (stakeholder, objective and process step) | 23 of 27 |
| Without a source stakeholder | 1 |
| Without an objective | 2 |
| Without a process step | 3 |
| Without a user story | 9 |

**Story coverage** is reported separately from verification. "Covered" only means at least one story implements the requirement. Whether its acceptance criteria were checked is a different question: in the demo, 2 of 36 criteria are recorded as passed, 1 failed, 1 blocked and 32 not tested. These are fictional review records; the toolkit does not run tests.

## Worked example: spare parts

The thread below exists in the demo data and can be followed in the application.

1. **Stakeholder.** Viktor Novak, Warehouse / Spare Parts Manager (interest high, influence medium, so *keep informed*). Expectation: "Parts requirements visible when a job is scheduled".
2. **Objective.** *Manage work orders digitally from creation to completion.*
3. **AS-IS step 8, Collect spare parts.** Bottleneck: *Parts not checked before the visit* (severity high), leading to return visits when a part is missing.
4. **TO-BE step 9, Reserve spare parts against the work order.** Marked *modified* and linked to AS-IS step 8. Improvement: *Parts reservation on work orders* (priority high).
5. **Requirement FR-007, Spare parts reservation.** "The system shall record the parts expected for a work order when the visit is scheduled and allow the warehouse to reserve them against the work order before the visit takes place." Priority Should, status Under Review. Source: Viktor Novak. Depends on FR-005 *Work order creation*. Its three acceptance criteria cover recording expected parts, showing reservations on the work order and flagging shortages before the visit.
6. **User story US-007, Reserve spare parts.** "As a Warehouse Manager, I want to reserve spare parts for scheduled service jobs, so that technicians have the required materials."
7. **Acceptance criteria.**
   - *AC-1 Parts reserved against work order.* Given a work order listing the expected parts, when the warehouse manager reserves the parts, then the reserved quantities are shown on the work order and deducted from available stock.
   - *AC-2 Shortage is visible before the visit.* Given a required part is out of stock, when the warehouse manager tries to reserve it, then the work order is flagged as waiting for parts and the dispatcher is notified.

   Both are recorded as *Not Tested*.

In the application: open FR-007 from the requirements register, or find its row in the traceability matrix, then follow the links to the stakeholder, the process steps and US-007. The AS-IS / TO-BE comparison shows AS-IS step 8 and TO-BE step 9 side by side with the bottleneck and the improvement.

## Worked example: a risk against the plan

**RSK-001, Technicians resist adopting the mobile work-order app** (category organisational).

- Probability 4 × impact 4 = **score 16, High**. Response: mitigate. Status: response planned. Owner: Sofia Lindqvist, Operations Manager.
- Linked to FR-006 *Digital work order completion*, NFR-005 *Usability for field technicians* and US-006 *Complete work orders on site*.
- Mitigation: involve two technicians in design reviews and pilot testing; keep mandatory fields to the minimum agreed with the Operations Manager. Contingency: extend the pilot and provide on-site support during the first weeks after go-live.

US-006 shows why verification is tracked separately from coverage. Its criterion *AC-2 Customer sign-off captured* is recorded as *Failed* in a fictional pilot review (the signature was not saved while the device was offline). The requirement is covered by a story, but the behaviour has not yet been accepted.

## Rules that keep the chain consistent

- A stakeholder cannot be deleted while they are a requirement source, step owner, story role or risk owner.
- A process step or objective cannot be removed while a requirement traces to it; a requirement cannot be deleted while a story implements it.
- Circular requirement dependencies are rejected when a requirement is saved.
- Deleting a record that a risk refers to only removes that link; the risk is kept, and the delete dialog says so.
