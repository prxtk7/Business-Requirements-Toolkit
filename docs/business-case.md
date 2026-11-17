# Business case: Northstar HVAC Services (fictional)

> **Fictional scenario.** Northstar HVAC Services, its staff, customers, processes and figures are invented to demonstrate business analysis techniques. Numeric targets are illustrative goals set by the fictional project team, not measured results or research findings.

## The organisation

Northstar HVAC Services installs, maintains and repairs heating, ventilation and air-conditioning systems for residential and commercial customers. A customer service team takes requests by phone and email, a dispatch team schedules field technicians, a warehouse manages spare parts and van stock, and finance invoices completed work.

## Current situation

Work is coordinated with phone calls, emails, shared spreadsheets, a whiteboard and individual calendars, and finance re-keys paper job sheets to raise invoices. The demo records this as an AS-IS process, *Handle repair and maintenance requests*, with 12 steps and eight bottlenecks, for example:

| AS-IS step | Recorded bottleneck | Severity |
| --- | --- | --- |
| Record service request manually | Incomplete and inconsistent request details | High |
| Review technician availability | No single view of technician availability | High |
| Collect spare parts | Parts not checked before the visit | High |
| Record job completion | Inconsistent completion records | High |
| Answer customer calls chasing updates | Customers chase status updates by phone | Medium |
| Re-key completed jobs for invoicing | Completed work re-keyed for invoicing | Medium |

## Problem statement

Service requests are recorded inconsistently, so information is often incomplete or duplicated. Dispatchers have limited visibility of technician availability, which makes allocating jobs slow and error-prone. Technicians sometimes arrive on site without the spare parts needed to finish the job, leading to repeat visits. Customers receive inconsistent updates about appointments and job progress, finance re-types job-sheet figures to invoice, and managers have little reliable operational data.

## Proposed change

The fictional company plans to introduce an integrated **Field Service Management (FSM) system**. The toolkit documents the analysis for that change. It does not implement the FSM system itself.

**In scope for the proposed FSM system**

- Service request intake from phone and email, with request status tracking for customer enquiries
- Technician scheduling, dispatch and calendar management, including rescheduling and notifying technicians of changes
- Work-order lifecycle management, including mobile access for technicians
- Spare-parts reservation against work orders
- Basic van stock visibility: parts held per van, parts used on work orders and the resulting stock quantities
- Automated appointment confirmations, reminders and status notifications
- Operational dashboards and standard management reports with exportable data
- Transfer of completed work-order data to the existing finance system, with a file export as the fallback
- Attachment and retrieval of site risk-assessment documents on work orders

**Out of scope**

- Replacing the finance and accounting system (integration only)
- Financial valuation, pricing, costing and invoice calculation, which stay in the finance system
- Procurement, supplier management, warehouse stock-taking, automatic replenishment and full inventory management
- Continuous live GPS tracking of technicians (scheduled availability, assignment and planned work location remain in scope)
- Health and safety management beyond attaching and retrieving risk-assessment documents on work orders
- Sales quotation and equipment design tools
- Payroll and HR

The TO-BE process (14 steps) shows the intended way of working. Compared with the AS-IS process: 1 step unchanged, 8 modified, 2 new and 3 automated; no step is removed. Customers should rarely need to phone for updates because acknowledgements, confirmations and reminders are sent automatically. When a customer does call, customer service answers from the request's status in the system instead of checking with dispatch (TO-BE step *Answer status enquiries from the FSM system*, which replaces *Answer customer calls chasing updates*).

## Scope decisions

A review of stakeholder expectations against the charter found capabilities the charter promised but no requirement delivered (van stock visibility, standard reports, finance integration), expectations with no requirement (technician change notifications, health and safety documents) and a risk (RSK-003) recorded against an integration that no requirement described. The decisions below resolved them. They were made by the author, acting as the fictional project team, and are part of the invented scenario: no real stakeholder approved them and no legal advice stands behind them.

| Decision | Outcome in the demo data |
| --- | --- |
| D1 Finance integration | New objective 7 and FR-014: completed work-order data is transferred to the finance system, with a file export as the fallback already named in RSK-003. Valuation and invoicing stay in the finance system. |
| D2 Customer status tracking | FR-012 kept in scope, raised from Could to Should, with testable criteria. It traces to the AS-IS step where customers chase updates and to the TO-BE step where customer service answers enquiries from the system. |
| D3 Live GPS tracking | Excluded. Recorded as FR-018 with priority Won't Have (this time) and status Deferred, so the request stays visible and can be reconsidered later. Scheduled availability, assignment and planned work location remain in scope; technician change notifications (FR-015) and customer reminders (FR-008) are unaffected. |
| D4 Health and safety documents | FR-017 attaches and retrieves site risk-assessment documents on work orders; nothing more. NFR-009 requires retention for a period that still has to be confirmed by management and a compliance adviser; no statutory period is assumed. |
| D5 Financial costing | Out of scope. The FSM system records labour time, parts and quantities; the finance system calculates cost and price. |
| D6 Van stock visibility | FR-016 (Could): view stock per van, record parts used, deduct quantities on completion. Procurement, supplier management, stock-taking and replenishment are excluded. |
| D7 Management reporting | FR-013: weekly operational report, completed-work-order report with technician workload information, exportable data. No location history or productivity rankings. |

Still open in the scenario:

- the retention period for NFR-009 (tracked as risk RSK-014);
- the data format for the finance interface (FR-014);
- whether customers should receive an on-the-way notification, which would need technician status information that D3 excludes;
- the IT Manager's expectation of a secure cloud solution that current IT staff can support. No hosting model, support arrangement or security standard has been decided, so it is recorded here as an open expectation rather than as a requirement.

## Objectives

1. Centralise the recording and tracking of all service requests.
2. Improve technician scheduling and allocation based on availability and skills.
3. Manage work orders digitally from creation to completion.
4. Give managers and coordinators clear visibility of field operations.
5. Provide customers with consistent appointment confirmations and status updates.
6. Deliver reliable management reporting on service performance.
7. Provide the finance department with complete and accurate completed-work-order data for invoicing without manual re-entry.

## Success criteria (illustrative)

- Target (illustrative): 100% of new service requests recorded in the system within three months of go-live.
- Target (illustrative): repeat visits caused by missing spare parts reduced by 30% against the pre-launch baseline.
- Target (illustrative): appointment confirmation sent for at least 95% of scheduled visits.
- Dispatchers can view technician availability and allocate jobs without spreadsheets.
- Managers can produce a weekly operational report without manual data collection.
- Target (illustrative): the operational dashboard shows every open service request and work order, with figures no more than 15 minutes old, from go-live (objective 4).
- Target (illustrative): at least 98% of completed work orders reach the finance system without manual re-entry within one working day of completion, measured over the first three months after go-live (objective 7).

The baselines behind these targets are not part of the scenario; in a real project they would have to be measured before go-live.

## Stakeholders

Ten stakeholders or stakeholder groups are recorded, each with interest, influence and expectations. The engagement strategy is derived from influence × interest:

| Strategy | Stakeholders |
| --- | --- |
| Manage closely | Managing Director (sponsor), Operations Manager |
| Keep satisfied | Finance Manager, IT Manager |
| Keep informed | Service Coordinator / Dispatcher, field technicians, Warehouse Manager, customer service team, a fictional commercial customer |
| Monitor | Health and Safety Officer |

## Main risks

Fourteen risks are recorded. The two rated Critical (score 20 of 25) are *Data migration produces incorrect service history* and *Technicians unavailable for testing delays implementation*. Another, *Finance system integration takes longer than planned*, is marked as materialised to show how the register handles a risk that has occurred. Two risks cover the scope added by the decisions above: technician-level reports being seen as monitoring individuals (RSK-013) and the unconfirmed retention period (RSK-014).
