import type { Bottleneck, BusinessProcess, Improvement, Level, ProcessStep, Responsibility } from '../domain/types';

/**
 * FICTIONAL DEMONSTRATION DATA — Northstar HVAC Services process analysis.
 *
 * The processes, problems and proposed improvements below are invented for
 * demonstration. They are not observations of a real company and contain no
 * measured figures.
 *
 * Stakeholder IDs refer to the demo stakeholder register in demoWorkspace.ts.
 */

export const DEMO_AS_IS_ID = 'prc_demo_as_is';
export const DEMO_TO_BE_ID = 'prc_demo_to_be';

const stakeholder = (stakeholderId: string): Responsibility => ({ type: 'stakeholder', stakeholderId });
const role = (name: string): Responsibility => ({ type: 'role', role: name });

const CUSTOMER_SERVICE = stakeholder('stk_demo_customer_service');
const DISPATCH = stakeholder('stk_demo_dispatch');
const TECHNICIANS = stakeholder('stk_demo_technicians');
const WAREHOUSE = stakeholder('stk_demo_warehouse');
const OPERATIONS = stakeholder('stk_demo_operations');
const FINANCE = stakeholder('stk_demo_finance');
const CUSTOMER = role('Customer (residential or commercial)');
const FSM_SYSTEM = role('Field Service Management System (automated)');

type StepSeed = Omit<ProcessStep, 'change' | 'sourceStepIds' | 'decision' | 'notes'> &
  Partial<Pick<ProcessStep, 'change' | 'sourceStepIds' | 'decision' | 'notes'>>;

const step = (seed: StepSeed): ProcessStep => ({
  decision: '',
  notes: '',
  change: null,
  sourceStepIds: [],
  ...seed,
});

const AS_IS_STEPS: ProcessStep[] = [
  step({
    id: 'stp_demo_as_contact',
    name: 'Customer reports a fault or maintenance need',
    description: 'The customer phones the office or sends an email describing the problem with their HVAC equipment.',
    responsible: CUSTOMER,
    input: 'Equipment fault, breakdown or due maintenance',
    output: 'Phone call or email to Northstar',
  }),
  step({
    id: 'stp_demo_as_record',
    name: 'Record service request manually',
    description:
      'A customer service representative writes the request into the shared service spreadsheet. Each person records the details in their own way.',
    responsible: CUSTOMER_SERVICE,
    input: 'Details given by the customer on the phone or in the email',
    output: 'New row in the shared service spreadsheet',
    notes: 'No mandatory fields; equipment model, site access and fault details are often missing.',
  }),
  step({
    id: 'stp_demo_as_availability',
    name: 'Review technician availability',
    description:
      'The dispatcher checks the whiteboard and individual technician calendars, and phones technicians to confirm where they are and when they will be free.',
    responsible: DISPATCH,
    input: 'Spreadsheet request, whiteboard schedule, technician calendars',
    output: 'Shortlist of possible technicians',
  }),
  step({
    id: 'stp_demo_as_assign',
    name: 'Assign technician manually',
    description: 'The dispatcher chooses a technician and writes the name on the whiteboard and in the spreadsheet.',
    responsible: DISPATCH,
    input: 'Shortlist of possible technicians',
    output: 'Technician name recorded against the request',
    decision: 'Is a technician with the required skills available in the time the customer needs?',
    notes: 'If not, the request waits on the spreadsheet until someone becomes free.',
  }),
  step({
    id: 'stp_demo_as_appointment',
    name: 'Agree appointment time with customer',
    description: 'The dispatcher phones the customer to agree a visit time. Several call attempts may be needed.',
    responsible: DISPATCH,
    input: 'Customer phone number, technician availability',
    output: 'Verbally agreed visit time',
    notes: 'A written confirmation is not always sent.',
  }),
  step({
    id: 'stp_demo_as_job_details',
    name: 'Pass job details to technician',
    description: 'The dispatcher sends the address and fault description to the technician by text message or phone call.',
    responsible: DISPATCH,
    input: 'Spreadsheet row, agreed visit time',
    output: 'Text message or call to the technician',
  }),
  step({
    id: 'stp_demo_as_status_calls',
    name: 'Answer customer calls chasing updates',
    description:
      'Customers call to ask when the technician will arrive. Customer service has to check with the dispatcher before answering.',
    responsible: CUSTOMER_SERVICE,
    input: 'Customer status enquiry',
    output: 'Verbal update to the customer',
  }),
  step({
    id: 'stp_demo_as_parts',
    name: 'Collect spare parts',
    description: 'The technician collects parts from the warehouse based on their own judgement of the fault description.',
    responsible: TECHNICIANS,
    input: 'Fault description from the text message',
    output: 'Parts loaded on the van',
    notes: 'Parts availability is not checked when the visit is scheduled.',
  }),
  step({
    id: 'stp_demo_as_visit',
    name: 'Carry out service visit',
    description: 'The technician diagnoses and repairs or services the equipment at the customer site.',
    responsible: TECHNICIANS,
    input: 'Job details, parts on the van',
    output: 'Repaired or serviced equipment',
    decision: 'Can the job be completed on this visit?',
    notes: 'If a part is missing, a return visit is arranged by phone.',
  }),
  step({
    id: 'stp_demo_as_completion',
    name: 'Record job completion',
    description:
      'The technician fills in a paper job sheet or sends a text message. Job sheets are returned to the office when the technician is next there.',
    responsible: TECHNICIANS,
    input: 'Work carried out, parts used, time on site',
    output: 'Paper job sheet or text message',
    notes: 'Completion records vary in detail and can arrive days later.',
  }),
  step({
    id: 'stp_demo_as_invoicing',
    name: 'Re-key completed jobs for invoicing',
    description:
      'Finance staff copy the labour time and parts used from returned job sheets into the finance system so that the customer can be invoiced.',
    responsible: FINANCE,
    input: 'Returned paper job sheets',
    output: 'Invoice raised in the finance system',
    notes: 'Invoicing waits for job sheets to reach the office, and figures are re-typed by hand.',
  }),
  step({
    id: 'stp_demo_as_reporting',
    name: 'Compile monthly operations summary',
    description:
      'The operations manager copies figures from the spreadsheet and job sheets into a monthly summary for the management team.',
    responsible: OPERATIONS,
    input: 'Service spreadsheet, returned job sheets',
    output: 'Manually compiled monthly summary',
  }),
];

const TO_BE_STEPS: ProcessStep[] = [
  step({
    id: 'stp_demo_to_contact',
    name: 'Customer reports a fault or maintenance need',
    description: 'The customer phones the office or sends an email, as today.',
    responsible: CUSTOMER,
    input: 'Equipment fault, breakdown or due maintenance',
    output: 'Phone call or email to Northstar',
    change: 'unchanged',
    sourceStepIds: ['stp_demo_as_contact'],
  }),
  step({
    id: 'stp_demo_to_register',
    name: 'Register service request in the FSM system',
    description:
      'Customer service registers the request using a structured form with mandatory fields: customer, site, equipment, fault category and priority.',
    responsible: CUSTOMER_SERVICE,
    input: 'Details given by the customer',
    output: 'Service request record with a unique reference',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_record'],
  }),
  step({
    id: 'stp_demo_to_acknowledge',
    name: 'Send request acknowledgement to customer',
    description: 'When the request is registered, the system automatically emails the customer the request reference.',
    responsible: FSM_SYSTEM,
    input: 'Registered service request',
    output: 'Acknowledgement email with request reference',
    change: 'new',
  }),
  step({
    id: 'stp_demo_to_availability',
    name: 'Review technician availability on the scheduling board',
    description: 'The dispatcher sees each technician’s calendar, skills and current job on a shared scheduling board.',
    responsible: DISPATCH,
    input: 'Service request, live technician schedules and skills',
    output: 'Suitable technicians and free time slots',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_availability'],
  }),
  step({
    id: 'stp_demo_to_schedule',
    name: 'Assign technician and schedule visit',
    description:
      'The dispatcher books the visit into a technician’s calendar on the scheduling board, and moves or reassigns it there when priorities change. The technician is notified of any change.',
    responsible: DISPATCH,
    input: 'Suitable technicians and free time slots',
    output: 'Scheduled visit linked to the service request',
    decision: 'Is a technician with the required skills available in the requested window?',
    notes: 'If not, the dispatcher offers the customer the next available slot.',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_assign', 'stp_demo_as_appointment'],
  }),
  step({
    id: 'stp_demo_to_confirm',
    name: 'Send appointment confirmation and reminder',
    description:
      'The system automatically sends the customer an appointment confirmation when the visit is scheduled, and a reminder the day before.',
    responsible: FSM_SYSTEM,
    input: 'Scheduled visit',
    output: 'Confirmation and reminder messages to the customer',
    change: 'automated',
    sourceStepIds: ['stp_demo_as_appointment'],
  }),
  step({
    id: 'stp_demo_to_work_order',
    name: 'Issue digital work order to technician',
    description:
      'When the visit is scheduled, the system automatically sends the work order, with site history, fault details and any attached site risk assessment, to the technician’s mobile app.',
    responsible: FSM_SYSTEM,
    input: 'Scheduled visit, service request details',
    output: 'Work order on the technician’s mobile device',
    change: 'automated',
    sourceStepIds: ['stp_demo_as_job_details'],
  }),
  step({
    id: 'stp_demo_to_status',
    name: 'Answer status enquiries from the FSM system',
    description:
      'When a customer contacts Northstar about an open request, customer service finds it by reference or customer name and answers from its current status and scheduled visit time, without checking with dispatch. Acknowledgements, confirmations and reminders are sent automatically, so customers should rarely need to call.',
    responsible: CUSTOMER_SERVICE,
    input: 'Customer enquiry; request status and scheduled visit in the FSM system',
    output: 'Enquiry answered at first contact',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_status_calls'],
  }),
  step({
    id: 'stp_demo_to_parts',
    name: 'Reserve spare parts against the work order',
    description: 'The warehouse manager reserves the required parts against the work order and confirms van stock before the visit.',
    responsible: WAREHOUSE,
    input: 'Work order with expected parts',
    output: 'Parts reserved and ready for collection',
    decision: 'Are the required parts in stock?',
    notes: 'If not, the visit is rescheduled before the technician travels.',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_parts'],
  }),
  step({
    id: 'stp_demo_to_visit',
    name: 'Carry out service visit',
    description: 'The technician carries out the work, using the work order and site history on their mobile device.',
    responsible: TECHNICIANS,
    input: 'Digital work order, reserved parts',
    output: 'Repaired or serviced equipment',
    decision: 'Can the job be completed on this visit?',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_visit'],
  }),
  step({
    id: 'stp_demo_to_complete',
    name: 'Complete work order on mobile device',
    description:
      'The technician closes the work order with mandatory fields: work carried out, parts used, time on site and customer sign-off. Parts used are deducted from the van’s stock.',
    responsible: TECHNICIANS,
    input: 'Work carried out, parts used, time on site',
    output: 'Completed digital work order',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_completion'],
  }),
  step({
    id: 'stp_demo_to_report_customer',
    name: 'Send service report to customer',
    description: 'When the work order is completed, the system automatically emails the customer a service report.',
    responsible: FSM_SYSTEM,
    input: 'Completed work order',
    output: 'Service report email',
    change: 'new',
  }),
  step({
    id: 'stp_demo_to_finance',
    name: 'Transfer completed work order to the finance system',
    description:
      'When the work order is completed, the system automatically transfers the customer, site, work carried out, labour time and parts used to the finance system. Prices and invoice amounts are calculated there, not in the FSM system. If the interface is unavailable, completed work orders are exported to a file for import.',
    responsible: FSM_SYSTEM,
    input: 'Completed work order',
    output: 'Completed-work data in the finance system (or an export file)',
    change: 'automated',
    sourceStepIds: ['stp_demo_as_invoicing'],
  }),
  step({
    id: 'stp_demo_to_dashboard',
    name: 'Review operational dashboard and reports',
    description: 'The operations manager reviews workload, job status and completion information on a central dashboard.',
    responsible: OPERATIONS,
    input: 'Service requests and work orders in the FSM system',
    output: 'Up-to-date operational dashboard and standard reports',
    change: 'modified',
    sourceStepIds: ['stp_demo_as_reporting'],
  }),
];

export function createDemoProcesses(now: string): BusinessProcess[] {
  const clone = (steps: ProcessStep[]) => steps.map((s) => ({ ...s, sourceStepIds: [...s.sourceStepIds] }));
  return [
    {
      id: DEMO_AS_IS_ID,
      type: 'as-is',
      name: 'Handle repair and maintenance requests',
      description:
        'Fictional current process at Northstar HVAC Services, from a customer reporting a problem to the job being recorded and reported.',
      objective: 'Resolve customer equipment problems by getting a suitable technician to site.',
      trigger: 'A customer contacts Northstar about faulty equipment or due maintenance.',
      startCondition: 'The customer has an equipment problem or maintenance need.',
      endCondition: 'The job is recorded as complete and included in the monthly summary.',
      baselineProcessId: null,
      steps: clone(AS_IS_STEPS),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: DEMO_TO_BE_ID,
      type: 'to-be',
      name: 'Handle repair and maintenance requests',
      description:
        'Fictional proposed process using the integrated Field Service Management (FSM) System, from request registration to operational reporting.',
      objective:
        'Resolve customer equipment problems with complete request information, planned parts and consistent customer communication.',
      trigger: 'A customer contacts Northstar about faulty equipment or due maintenance.',
      startCondition: 'The customer has an equipment problem or maintenance need.',
      endCondition:
        'The work order is completed, the customer has a service report, finance has the completed-work data and the job appears in operational reporting.',
      baselineProcessId: DEMO_AS_IS_ID,
      steps: clone(TO_BE_STEPS),
      createdAt: now,
      updatedAt: now,
    },
  ];
}

interface BottleneckSeed {
  id: string;
  stepId: string;
  title: string;
  description: string;
  impact: string;
  severity: Level;
  suggestedImprovement: string;
}

const BOTTLENECKS: BottleneckSeed[] = [
  {
    id: 'btl_demo_incomplete_requests',
    stepId: 'stp_demo_as_record',
    title: 'Incomplete and inconsistent request details',
    description: 'Requests are typed into free-form spreadsheet rows, so key details depend on who takes the call.',
    impact: 'Dispatchers and technicians have to call customers back; visits can start without the right information.',
    severity: 'high',
    suggestedImprovement: 'Structured request form with mandatory fields.',
  },
  {
    id: 'btl_demo_no_availability_view',
    stepId: 'stp_demo_as_availability',
    title: 'No single view of technician availability',
    description: 'Availability is spread across a whiteboard, personal calendars and phone calls.',
    impact: 'Allocating a technician is slow, and urgent jobs can wait while availability is checked.',
    severity: 'high',
    suggestedImprovement: 'Shared scheduling board showing calendars, skills and current jobs.',
  },
  {
    id: 'btl_demo_manual_appointments',
    stepId: 'stp_demo_as_appointment',
    title: 'Manual appointment coordination',
    description: 'Visit times are agreed by phone and confirmations are not sent consistently.',
    impact: 'Repeated call attempts for staff; customers are unsure when the technician will arrive.',
    severity: 'medium',
    suggestedImprovement: 'Automatic appointment confirmations and reminders.',
  },
  {
    id: 'btl_demo_status_calls',
    stepId: 'stp_demo_as_status_calls',
    title: 'Customers chase status updates by phone',
    description: 'Customers have no other way to find out what is happening with their request.',
    impact: 'Customer service time is spent relaying information between customers and dispatch.',
    severity: 'medium',
    suggestedImprovement: 'Proactive customer notifications at key points in the job.',
  },
  {
    id: 'btl_demo_missing_parts',
    stepId: 'stp_demo_as_parts',
    title: 'Parts not checked before the visit',
    description: 'Technicians pick parts from the fault description; nothing confirms the right parts are available.',
    impact: 'Return visits when a part is missing, and a longer wait for the customer.',
    severity: 'high',
    suggestedImprovement: 'Reserve parts against the work order when the visit is scheduled.',
  },
  {
    id: 'btl_demo_completion_records',
    stepId: 'stp_demo_as_completion',
    title: 'Inconsistent completion records',
    description: 'Paper job sheets and text messages vary in detail and can reach the office days later.',
    impact: 'Incomplete service history and delays in confirming completed work.',
    severity: 'high',
    suggestedImprovement: 'Digital work-order completion with mandatory fields.',
  },
  {
    id: 'btl_demo_rekeying',
    stepId: 'stp_demo_as_invoicing',
    title: 'Completed work re-keyed for invoicing',
    description: 'Labour time and parts used are typed into the finance system from paper job sheets once the sheets reach the office.',
    impact: 'Invoices are delayed and can contain transcription errors; finance cannot see which jobs are complete until the job sheets arrive.',
    severity: 'medium',
    suggestedImprovement: 'Transfer completed work-order data to the finance system automatically.',
  },
  {
    id: 'btl_demo_manual_reporting',
    stepId: 'stp_demo_as_reporting',
    title: 'Manual, monthly reporting',
    description: 'Figures are copied by hand from spreadsheets and job sheets once a month.',
    impact: 'Limited and out-of-date management visibility of field operations.',
    severity: 'medium',
    suggestedImprovement: 'Central operational dashboard using live system data.',
  },
];

interface ImprovementSeed {
  id: string;
  stepId: string;
  title: string;
  description: string;
  relatedProblem: string;
  expectedBenefit: string;
  priority: Level;
}

const IMPROVEMENTS: ImprovementSeed[] = [
  {
    id: 'imp_demo_structured_form',
    stepId: 'stp_demo_to_register',
    title: 'Structured service request form',
    description: 'Mandatory fields for customer, site, equipment, fault category and priority.',
    relatedProblem: 'Incomplete and inconsistent request details',
    expectedBenefit: 'Complete information captured at first contact; fewer call-backs.',
    priority: 'high',
  },
  {
    id: 'imp_demo_scheduling_board',
    stepId: 'stp_demo_to_availability',
    title: 'Shared scheduling board',
    description: 'One view of technician calendars, skills and current jobs.',
    relatedProblem: 'No single view of technician availability',
    expectedBenefit: 'Faster, better-informed technician allocation.',
    priority: 'high',
  },
  {
    id: 'imp_demo_confirmations',
    stepId: 'stp_demo_to_confirm',
    title: 'Automatic confirmations and reminders',
    description: 'Appointment confirmation on scheduling and a reminder the day before the visit.',
    relatedProblem: 'Manual appointment coordination',
    expectedBenefit: 'Consistent customer communication and fewer status calls.',
    priority: 'high',
  },
  {
    id: 'imp_demo_status_lookup',
    stepId: 'stp_demo_to_status',
    title: 'Request status available to customer service',
    description: 'Each request shows its current status and scheduled visit, so customer service can answer an enquiry without contacting dispatch.',
    relatedProblem: 'Customers chase status updates by phone',
    expectedBenefit: 'Enquiries answered at first contact; dispatch is no longer interrupted to relay updates.',
    priority: 'medium',
  },
  {
    id: 'imp_demo_parts_reservation',
    stepId: 'stp_demo_to_parts',
    title: 'Parts reservation on work orders',
    description: 'Parts are reserved against the work order and checked before the technician travels.',
    relatedProblem: 'Parts not checked before the visit',
    expectedBenefit: 'Fewer return visits caused by missing parts.',
    priority: 'high',
  },
  {
    id: 'imp_demo_digital_completion',
    stepId: 'stp_demo_to_complete',
    title: 'Mandatory digital completion fields',
    description: 'Work orders cannot be closed without work done, parts used, time on site and customer sign-off.',
    relatedProblem: 'Inconsistent completion records',
    expectedBenefit: 'Consistent, timely service history for every job.',
    priority: 'high',
  },
  {
    id: 'imp_demo_service_report',
    stepId: 'stp_demo_to_report_customer',
    title: 'Automatic service report to customer',
    description: 'A service report is emailed to the customer when the work order is completed.',
    relatedProblem: 'Customers chase status updates by phone',
    expectedBenefit: 'Customers receive a clear record of the work carried out.',
    priority: 'low',
  },
  {
    id: 'imp_demo_finance_transfer',
    stepId: 'stp_demo_to_finance',
    title: 'Automatic transfer of completed work orders to finance',
    description: 'Operational data from each completed work order is transferred to the finance system, with a file export as the fallback.',
    relatedProblem: 'Completed work re-keyed for invoicing',
    expectedBenefit: 'Invoicing can start as soon as the work order is closed, without re-typing.',
    priority: 'medium',
  },
  {
    id: 'imp_demo_dashboard',
    stepId: 'stp_demo_to_dashboard',
    title: 'Operational dashboard',
    description: 'Live view of workload, job status and completion for managers and coordinators.',
    relatedProblem: 'Manual, monthly reporting',
    expectedBenefit: 'Up-to-date management visibility without manual data collection.',
    priority: 'medium',
  },
];

export function createDemoBottlenecks(now: string): Bottleneck[] {
  return BOTTLENECKS.map((b) => ({ ...b, createdAt: now, updatedAt: now }));
}

export function createDemoImprovements(now: string): Improvement[] {
  return IMPROVEMENTS.map((i) => ({ ...i, createdAt: now, updatedAt: now }));
}
