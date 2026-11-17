import type { Level, Stakeholder, Workspace } from '../domain/types';
import { createDemoBottlenecks, createDemoImprovements, createDemoProcesses } from './demoProcesses';
import { DEMO_REQUIREMENT_SEQUENCE, createDemoRequirements } from './demoRequirements';
import { DEMO_STORY_SEQUENCE, createDemoUserStories } from './demoUserStories';
import { DEMO_RISK_SEQUENCE, createDemoRisks } from './demoRisks';

/**
 * FICTIONAL DEMONSTRATION DATA
 *
 * "Northstar HVAC Services" and every person, team, customer and figure
 * below are invented for demonstration purposes. Nothing here describes a
 * real company, and no statement is a real research finding. Numeric targets
 * are illustrative goals set by the fictional project team.
 */

export const DEMO_ORGANISATION = 'Northstar HVAC Services (fictional)';

/** Project objectives with stable ids so demo requirements can trace to them. */
export const DEMO_OBJECTIVES = [
  { id: 'obj_demo_requests', text: 'Centralise the recording and tracking of all service requests' },
  { id: 'obj_demo_scheduling', text: 'Improve technician scheduling and allocation based on availability and skills' },
  { id: 'obj_demo_work_orders', text: 'Manage work orders digitally from creation to completion' },
  { id: 'obj_demo_visibility', text: 'Give managers and coordinators clear visibility of field operations' },
  { id: 'obj_demo_customer_comms', text: 'Provide customers with consistent appointment confirmations and status updates' },
  { id: 'obj_demo_reporting', text: 'Deliver reliable management reporting on service performance' },
  {
    id: 'obj_demo_finance',
    text: 'Provide the finance department with complete and accurate completed-work-order data for invoicing without manual re-entry',
  },
] as const;

interface DemoStakeholderSeed {
  id: string;
  name: string;
  role: string;
  description: string;
  interest: Level;
  influence: Level;
  expectations: string[];
}

/** Stable IDs so that later modules (requirements, risks) can reference them. */
const DEMO_STAKEHOLDERS: DemoStakeholderSeed[] = [
  {
    id: 'stk_demo_sponsor',
    name: 'Daniel Hartley',
    role: 'Managing Director (Project Sponsor)',
    description:
      'Accountable for company performance and owner of the budget for the Field Service Management initiative. Final approver for scope, supplier selection and go-live.',
    interest: 'high',
    influence: 'high',
    expectations: [
      'Clear business case with measurable operational benefits',
      'Delivery without disruption to peak-season heating and cooling work',
      'Better visibility of company-wide service performance',
    ],
  },
  {
    id: 'stk_demo_operations',
    name: 'Sofia Lindqvist',
    role: 'Operations Manager',
    description:
      'Runs day-to-day field operations, including the dispatch team and all field service technicians. Business owner of the service process and the future system.',
    interest: 'high',
    influence: 'high',
    expectations: [
      'Real-time view of open service requests and work orders',
      'Fewer repeat visits and missed appointments',
      'Reliable weekly reports without manual spreadsheet work',
    ],
  },
  {
    id: 'stk_demo_dispatch',
    name: 'Aisha Rahman',
    role: 'Service Coordinator / Dispatcher',
    description:
      'Leads the dispatch team that schedules service visits and allocates technicians. Currently plans work using a whiteboard, shared spreadsheets and phone calls.',
    interest: 'high',
    influence: 'medium',
    expectations: [
      'Single view of technician availability, skills and location',
      'Drag-and-drop rescheduling when urgent jobs arrive',
      'Automatic notification to technicians when a job changes',
    ],
  },
  {
    id: 'stk_demo_technicians',
    name: 'Field Service Technicians',
    role: 'Field service technicians (user group)',
    description:
      'Certified HVAC technicians who carry out installations, planned maintenance and repairs at customer sites. Primary users of the mobile work-order application.',
    interest: 'high',
    influence: 'medium',
    expectations: [
      'Complete job details and site history before arriving',
      'Confirmation that required parts are reserved for the job',
      'Quick job completion on a mobile device, including in areas with poor signal',
    ],
  },
  {
    id: 'stk_demo_warehouse',
    name: 'Viktor Novak',
    role: 'Warehouse / Spare Parts Manager',
    description:
      'Manages the central warehouse and van stock. Responsible for making sure the right spare parts are available for scheduled jobs.',
    interest: 'high',
    influence: 'medium',
    expectations: [
      'Parts requirements visible when a job is scheduled',
      'Van stock levels updated when technicians use parts',
      'Early warning of parts shortages for upcoming work',
    ],
  },
  {
    id: 'stk_demo_customer_service',
    name: 'Customer Service Representatives',
    role: 'Customer service team (user group)',
    description:
      'Handle incoming customer calls and emails, record service requests and answer questions about appointment times and job status.',
    interest: 'high',
    influence: 'low',
    expectations: [
      'One place to record and look up service requests',
      'Up-to-date appointment and job status when customers call',
      'Fewer calls from customers chasing updates',
    ],
  },
  {
    id: 'stk_demo_customer',
    name: 'Harbourview Offices (fictional customer)',
    role: 'Customer representative — commercial maintenance contract',
    description:
      'Facilities manager at a fictional commercial customer with a planned-maintenance contract. Represents the customer perspective in workshops and testing.',
    interest: 'high',
    influence: 'low',
    expectations: [
      'Confirmed appointment windows and arrival notifications',
      'Problems fixed on the first visit',
      'Service reports available after each visit',
    ],
  },
  {
    id: 'stk_demo_finance',
    name: 'Grace Whitmore',
    role: 'Finance Manager',
    description:
      'Responsible for budgeting, invoicing and cost control. Relies on accurate records of completed work, labour time and parts used.',
    interest: 'medium',
    influence: 'high',
    expectations: [
      'Completed work orders flow into invoicing without re-keying',
      'Project stays within the approved budget',
      'Accurate labour and parts cost per job',
    ],
  },
  {
    id: 'stk_demo_it',
    name: 'Kenji Watanabe',
    role: 'IT Manager',
    description:
      'Responsible for company systems, devices and data security. Will support the new platform and its integrations with existing finance and email systems.',
    interest: 'medium',
    influence: 'high',
    expectations: [
      'Secure cloud solution that IT can support with current staff',
      'Integration with the existing finance system',
      'Managed mobile devices for technicians',
    ],
  },
  {
    id: 'stk_demo_health_safety',
    name: 'Health and Safety Officer',
    role: 'Compliance and safety (support function)',
    description:
      'Maintains safety procedures, refrigerant-handling records and site risk assessments. Needs awareness of how job records will capture compliance information.',
    interest: 'low',
    influence: 'medium',
    expectations: [
      'Site risk assessments attached to work orders',
      'Compliance records retained and retrievable',
    ],
  },
];

export function createDemoWorkspace(now: string): Workspace {
  const stakeholders: Stakeholder[] = DEMO_STAKEHOLDERS.map((seed) => ({
    ...seed,
    expectations: [...seed.expectations],
    createdAt: now,
    updatedAt: now,
  }));

  return {
    meta: { origin: 'demo', createdAt: now },
    project: {
      name: 'Field Service Management System',
      organisation: DEMO_ORGANISATION,
      background:
        'Northstar HVAC Services is a fictional HVAC company used as a demonstration scenario. It installs, maintains and repairs heating, ventilation and air-conditioning systems for residential and commercial customers. Service requests arrive by phone and email and are recorded in shared spreadsheets by the customer service and dispatch teams. Technician schedules are kept on a whiteboard and in individual calendars, spare-parts stock is tracked separately by the warehouse, and job details reach technicians by phone or text message.',
      problemStatement:
        'Service requests are recorded inconsistently, so information is often incomplete or duplicated. Dispatchers have limited visibility of technician availability, which makes allocating jobs slow and error-prone. Technicians sometimes arrive on site without the spare parts needed to finish the job, leading to repeat visits. Customers receive inconsistent updates about appointment times and job progress, and managers have little reliable operational data to plan and report on the business.',
      objectives: DEMO_OBJECTIVES.map((o) => ({ ...o })),
      // Scope items reflect the fictional project-team decisions recorded in docs/business-case.md.
      inScope: [
        'Service request intake from phone and email, with request status tracking for customer enquiries',
        'Technician scheduling, dispatch and calendar management, including rescheduling and notifying technicians of changes',
        'Work-order lifecycle management, including mobile access for technicians',
        'Spare-parts reservation against work orders',
        'Basic van stock visibility: parts held per van, parts used on work orders and the resulting stock quantities',
        'Automated customer appointment confirmations, reminders and status notifications',
        'Operational dashboards and standard management reports with exportable data',
        'Transfer of completed work-order data to the existing finance system, with a file export as the fallback',
        'Attachment and retrieval of site risk-assessment documents on work orders',
      ],
      outOfScope: [
        'Replacement of the finance and accounting system (integration only)',
        'Financial valuation, pricing, costing and invoice calculation, which stay in the finance system',
        'Procurement, supplier management, warehouse stock-taking, automatic replenishment and full inventory management',
        'Continuous live GPS tracking of technicians (scheduled availability, assignment and planned work location remain in scope)',
        'Health and safety management beyond attaching and retrieving risk-assessment documents on work orders',
        'Sales quotation and equipment design tools',
        'Payroll and HR processes',
      ],
      successCriteria: [
        'Target (illustrative): 100% of new service requests recorded in the system within three months of go-live',
        'Target (illustrative): repeat visits caused by missing spare parts reduced by 30% against the pre-launch baseline',
        'Target (illustrative): appointment confirmation sent for at least 95% of scheduled visits',
        'Dispatchers can view technician availability and allocate jobs without using spreadsheets',
        'Managers can produce a weekly operational report without manual data collection',
        'Target (illustrative): the operational dashboard shows every open service request and work order, with figures no more than 15 minutes old, from go-live',
        'Target (illustrative): at least 98% of completed work orders reach the finance system without manual re-entry within one working day of completion, measured over the first three months after go-live',
      ],
      updatedAt: null,
    },
    stakeholders,
    processes: createDemoProcesses(now),
    bottlenecks: createDemoBottlenecks(now),
    improvements: createDemoImprovements(now),
    requirements: createDemoRequirements(now),
    requirementSequence: { ...DEMO_REQUIREMENT_SEQUENCE },
    userStories: createDemoUserStories(now),
    storySequence: DEMO_STORY_SEQUENCE,
    risks: createDemoRisks(now),
    riskSequence: DEMO_RISK_SEQUENCE,
  };
}
