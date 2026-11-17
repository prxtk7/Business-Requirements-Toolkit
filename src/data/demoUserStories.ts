import type { AcceptanceCriterion, StoryPersona, UserStory, VerificationStatus } from '../domain/types';

/**
 * FICTIONAL DEMONSTRATION DATA — Northstar HVAC Services user stories.
 *
 * Illustrative user stories derived from the demo requirements. Verification
 * statuses are fictional records of a pilot review: the toolkit documents
 * expected behaviour and does not run tests against any system. Most criteria
 * are deliberately "Not Tested".
 *
 * Some requirements intentionally have no user story (FR-012, FR-014, FR-018,
 * NFR-001, NFR-003, NFR-004, NFR-007, NFR-008, NFR-009) to show coverage gaps.
 */

type CriterionSeed = Omit<AcceptanceCriterion, 'id' | 'number' | 'notes' | 'verification'> & {
  notes?: string;
  verification?: VerificationStatus;
};

interface StorySeed {
  n: number;
  title: string;
  persona: StoryPersona;
  need: string;
  benefit: string;
  description?: string;
  requirements: string[];
  priority: UserStory['priority'];
  status: UserStory['status'];
  criteria: CriterionSeed[];
}

const persona = (stakeholderId: string | null, label: string): StoryPersona => ({ stakeholderId, label });
const CSR = persona('stk_demo_customer_service', 'Customer Service Representative');
const DISPATCHER = persona('stk_demo_dispatch', 'Service Coordinator');
const TECHNICIAN = persona('stk_demo_technicians', 'Field Service Technician');
const WAREHOUSE = persona('stk_demo_warehouse', 'Warehouse Manager');
const OPERATIONS = persona('stk_demo_operations', 'Operations Manager');
const IT = persona('stk_demo_it', 'IT Manager');
const CUSTOMER = persona('stk_demo_customer', 'commercial customer');
const req = (n: string) => `req_demo_${n}`;

const SEEDS: StorySeed[] = [
  {
    n: 1,
    title: 'Register service requests',
    persona: CSR,
    need: 'to register customer service requests in a centralised system',
    benefit: 'requests can be consistently recorded and tracked',
    requirements: [req('fr001')],
    priority: 'must',
    status: 'implemented',
    criteria: [
      {
        title: 'Complete request is registered',
        given: 'a Customer Service Representative is logged into the system',
        when: 'they submit a service request containing all mandatory information',
        then: 'the system registers the request and shows a unique reference number',
        verification: 'passed',
        notes: 'Fictional pilot review record.',
      },
      {
        title: 'Incomplete request is rejected',
        given: 'a service request form with the equipment field left empty',
        when: 'the representative tries to save it',
        then: 'the request is not saved and the equipment field is highlighted as required',
        verification: 'passed',
        notes: 'Fictional pilot review record.',
      },
      {
        title: 'Email requests use the same register',
        given: 'a request received by email',
        when: 'the representative registers it',
        then: 'it appears in the same request list as requests taken by phone, with its source recorded as email',
      },
    ],
  },
  {
    n: 2,
    title: 'Receive request acknowledgement',
    persona: CUSTOMER,
    need: 'to receive an acknowledgement with a reference when I report a fault',
    benefit: 'I know my request has been received and can quote the reference',
    requirements: [req('fr002')],
    priority: 'should',
    status: 'proposed',
    criteria: [
      {
        title: 'Acknowledgement sent on registration',
        given: 'a customer with a valid email address',
        when: 'their service request is registered',
        then: 'they receive an email containing the request reference',
      },
      {
        title: 'No email address on file',
        given: 'a customer without an email address',
        when: 'their service request is registered',
        then: 'the representative is prompted to give the reference verbally and the request records that no email was sent',
      },
    ],
  },
  {
    n: 3,
    title: 'View technician availability',
    persona: DISPATCHER,
    need: 'to see each technician’s availability and skills on one scheduling board',
    benefit: 'I can choose a suitable technician without phoning around',
    requirements: [req('fr003')],
    priority: 'must',
    status: 'ready',
    criteria: [
      {
        title: 'Daily availability is shown',
        given: 'the dispatcher opens the scheduling board for a selected day',
        when: 'the board loads',
        then: 'each technician’s booked visits and free time slots for that day are shown',
      },
      {
        title: 'Skills are visible',
        given: 'a service request that needs a refrigerant-certified technician',
        when: 'the dispatcher filters the board by that skill',
        then: 'only technicians holding the skill are listed',
      },
    ],
  },
  {
    n: 4,
    title: 'Assign available technicians',
    persona: DISPATCHER,
    need: 'to assign a technician to a service request and book the visit',
    benefit: 'visits are booked against real availability and double bookings are avoided',
    requirements: [req('fr004'), req('fr003')],
    priority: 'must',
    status: 'ready',
    criteria: [
      {
        title: 'Booked visit appears in schedule',
        given: 'a dispatcher is viewing the scheduling board',
        when: 'they assign an available technician to a service appointment',
        then: 'the appointment appears in that technician’s schedule and is linked to the service request',
      },
      {
        title: 'Double booking is flagged',
        given: 'a technician already has a visit from 09:00 to 11:00',
        when: 'the dispatcher tries to book another visit for that technician at 10:00',
        then: 'the system warns that the technician is already booked and does not save the second visit without confirmation',
      },
    ],
  },
  {
    n: 5,
    title: 'Receive digital work orders',
    persona: TECHNICIAN,
    need: 'to access digital work orders on my mobile device',
    benefit: 'I can view job details while performing service visits',
    requirements: [req('fr005'), req('nfr006')],
    priority: 'must',
    status: 'under-review',
    criteria: [
      {
        title: 'Work order delivered on assignment',
        given: 'a visit is scheduled for a technician',
        when: 'the dispatcher confirms the assignment',
        then: 'the work order appears in that technician’s mobile app with the site address and fault details',
      },
      {
        title: 'Site history included',
        given: 'a site with previous completed work orders',
        when: 'the technician opens a new work order for that site',
        then: 'the previous work orders for the site are listed',
      },
    ],
  },
  {
    n: 6,
    title: 'Complete work orders on site',
    persona: TECHNICIAN,
    need: 'to record the work carried out, parts used and customer sign-off on my mobile device',
    benefit: 'completion records are consistent and reach the office immediately',
    requirements: [req('fr006'), req('nfr005')],
    priority: 'must',
    status: 'under-review',
    criteria: [
      {
        title: 'Mandatory fields enforced',
        given: 'an open work order',
        when: 'the technician tries to close it without recording the parts used',
        then: 'the work order stays open and the parts-used field is marked as required',
      },
      {
        title: 'Customer sign-off captured',
        given: 'all mandatory completion fields are filled in',
        when: 'the customer signs on the technician’s device',
        then: 'the signature is stored with the completed work order',
        verification: 'failed',
        notes: 'Fictional pilot review record: signature was not saved when the device was offline.',
      },
      {
        title: 'Completion visible to the office',
        given: 'a technician completes a work order with a connection available',
        when: 'they close the work order',
        then: 'the work order shows as completed in the office view',
      },
    ],
  },
  {
    n: 7,
    title: 'Reserve spare parts',
    persona: WAREHOUSE,
    need: 'to reserve spare parts for scheduled service jobs',
    benefit: 'technicians have the required materials',
    requirements: [req('fr007')],
    priority: 'should',
    status: 'under-review',
    criteria: [
      {
        title: 'Parts reserved against work order',
        given: 'a work order listing the expected parts',
        when: 'the warehouse manager reserves the parts',
        then: 'the reserved quantities are shown on the work order and deducted from available stock',
      },
      {
        title: 'Shortage is visible before the visit',
        given: 'a required part is out of stock',
        when: 'the warehouse manager tries to reserve it',
        then: 'the work order is flagged as waiting for parts and the dispatcher is notified',
      },
    ],
  },
  {
    n: 8,
    title: 'Notify customers of appointments',
    persona: CUSTOMER,
    need: 'to receive an automatic confirmation when my visit is booked or changed',
    benefit: 'I know when the technician is expected to arrive',
    requirements: [req('fr008')],
    priority: 'should',
    status: 'approved',
    criteria: [
      {
        title: 'Confirmation on booking',
        given: 'a visit has been scheduled',
        when: 'the booking is saved',
        then: 'the customer receives a confirmation stating the date and arrival window',
      },
      {
        title: 'Change of appointment',
        given: 'a confirmed visit',
        when: 'the dispatcher moves it to another day',
        then: 'the customer receives an updated confirmation and the previous time is cancelled',
      },
    ],
  },
  {
    n: 9,
    title: 'Get a reminder before the visit',
    persona: CUSTOMER,
    need: 'a reminder the day before a scheduled visit',
    benefit: 'someone is available to give the technician access to the site',
    requirements: [req('fr008')],
    priority: 'could',
    status: 'proposed',
    criteria: [
      {
        title: 'Reminder sent the day before',
        given: 'a visit scheduled for tomorrow',
        when: 'the daily reminder run takes place',
        then: 'the customer receives a reminder with the arrival window and the request reference',
      },
      {
        title: 'No reminder for cancelled visits',
        given: 'a visit that has been cancelled',
        when: 'the daily reminder run takes place',
        then: 'no reminder is sent for that visit',
      },
    ],
  },
  {
    n: 10,
    title: 'View equipment service history',
    persona: TECHNICIAN,
    need: 'to see the service history of the equipment I am working on',
    benefit: 'I can diagnose recurring faults faster',
    requirements: [req('fr009')],
    priority: 'should',
    status: 'draft',
    criteria: [
      {
        title: 'History listed for equipment',
        given: 'equipment with three previous completed work orders',
        when: 'the technician opens the equipment record',
        then: 'the three work orders are listed with their dates and work carried out, most recent first',
      },
    ],
  },
  {
    n: 11,
    title: 'Monitor operational performance',
    persona: OPERATIONS,
    need: 'a dashboard of open requests, scheduled work and completed work orders',
    benefit: 'I can manage workload without compiling spreadsheets',
    requirements: [req('fr010')],
    priority: 'should',
    status: 'under-review',
    criteria: [
      {
        title: 'Open work by status',
        given: 'service requests in several statuses',
        when: 'the operations manager opens the dashboard',
        then: 'the number of requests in each status is shown and matches the request list',
      },
      {
        title: 'Weekly completed work',
        given: 'work orders completed during the current week',
        when: 'the operations manager selects the weekly view',
        then: 'the completed work orders for that week are counted by technician',
      },
    ],
  },
  {
    n: 12,
    title: 'Receive a service report',
    persona: CUSTOMER,
    need: 'to receive a report of the work carried out after each visit',
    benefit: 'I have a record for my maintenance files',
    requirements: [req('fr011')],
    priority: 'could',
    status: 'draft',
    criteria: [
      {
        title: 'Report sent on completion',
        given: 'a work order is completed with customer sign-off',
        when: 'the work order is closed',
        then: 'the customer receives a service report listing the work carried out and parts used',
      },
    ],
  },
  {
    n: 13,
    title: 'Restrict access by role',
    persona: IT,
    need: 'to grant each user access only to the functions their role needs',
    benefit: 'customer and site information is protected',
    requirements: [req('nfr002')],
    priority: 'must',
    status: 'approved',
    criteria: [
      {
        title: 'Technicians see only their work orders',
        given: 'a technician is logged in',
        when: 'they open the work order list',
        then: 'only work orders assigned to them are listed',
      },
      {
        title: 'Only managers change roles',
        given: 'a user without the manager role',
        when: 'they try to change another user’s role',
        then: 'the change is refused and the attempt is recorded',
      },
    ],
  },
  {
    n: 14,
    title: 'Work without a connection on site',
    persona: TECHNICIAN,
    need: 'to keep updating my work order when there is no mobile signal',
    benefit: 'I can finish the job in plant rooms and basements',
    requirements: [req('nfr006'), req('fr006')],
    priority: 'must',
    status: 'under-review',
    criteria: [
      {
        title: 'Offline updates are kept',
        given: 'the technician’s device has no connection',
        when: 'they record work carried out on an open work order',
        then: 'the update is stored on the device and marked as waiting to sync',
      },
      {
        title: 'Updates sync when connected',
        given: 'a work order with updates waiting to sync',
        when: 'the device reconnects',
        then: 'the updates appear in the office view and the waiting-to-sync marker is cleared',
        verification: 'blocked',
        notes: 'Fictional pilot review record: blocked until managed test devices are available.',
      },
    ],
  },
  {
    n: 15,
    title: 'Produce the weekly operational report',
    persona: OPERATIONS,
    need: 'a weekly report of requests received, visits scheduled and work orders completed that I can export',
    benefit: 'I can report to the management team without compiling spreadsheets by hand',
    requirements: [req('fr013')],
    priority: 'should',
    status: 'proposed',
    criteria: [
      {
        title: 'Weekly figures match the lists',
        given: 'requests, visits and completed work orders have been recorded for a week',
        when: 'I select that week and open the weekly operational report',
        then: 'the report shows the number of requests received, visits scheduled and work orders completed, and each figure matches the corresponding list',
      },
      {
        title: 'Report can be exported',
        given: 'the weekly operational report is open',
        when: 'I choose to export it',
        then: 'a CSV file containing the rows shown on screen is downloaded',
      },
    ],
  },
  {
    n: 16,
    title: 'Be told when my work order changes',
    persona: TECHNICIAN,
    need: 'to be notified on my mobile device when a work order assigned to me is rescheduled, reassigned or cancelled',
    benefit: 'I do not travel to the wrong site or at the wrong time',
    requirements: [req('fr015')],
    priority: 'should',
    status: 'proposed',
    criteria: [
      {
        title: 'Rescheduled visit is notified',
        given: 'a work order assigned to me is scheduled for 09:00 tomorrow',
        when: 'the dispatcher moves the visit to 14:00',
        then: 'I receive a notification on my device showing the old and new times, and the work order shows the new time',
      },
      {
        title: 'Reassigned work order is removed',
        given: 'a work order is assigned to me',
        when: 'the dispatcher reassigns it to another technician',
        then: 'I receive a notification that it was reassigned and it no longer appears in my list of work orders',
      },
    ],
  },
  {
    n: 17,
    title: 'Open the site risk assessment on a work order',
    persona: TECHNICIAN,
    need: 'to open the risk-assessment document attached to my work order before I start work on site',
    benefit: 'I can follow the site-specific safety precautions',
    requirements: [req('fr017')],
    priority: 'should',
    status: 'draft',
    criteria: [
      {
        title: 'Attached document opens on the device',
        given: 'office staff have attached a site risk assessment to my work order',
        when: 'I open the work order on my mobile device',
        then: 'the document is listed on the work order and opens when I select it',
      },
      {
        title: 'Document stays with the completed work order',
        given: 'a work order with an attached risk assessment has been completed',
        when: 'the work order is opened from the site’s service history',
        then: 'the attached document is still listed and can be opened',
      },
    ],
  },
  {
    n: 18,
    title: 'See what is on each van',
    persona: WAREHOUSE,
    need: 'to see the current quantity of each part held on a technician’s van',
    benefit: 'I can reserve parts from the van before issuing them from the central store',
    requirements: [req('fr016')],
    priority: 'could',
    status: 'proposed',
    criteria: [
      {
        title: 'Van stock is listed',
        given: 'a van holds 4 units of a part',
        when: 'I open that van’s stock list',
        then: 'the part is listed with a quantity of 4',
      },
      {
        title: 'Parts used reduce van stock',
        given: 'a van holds 4 units of a part',
        when: 'the technician completes a work order on that van recording 1 unit of the part as used',
        then: 'the van’s stock list shows 3 units of the part',
      },
    ],
  },
];

export const DEMO_STORY_SEQUENCE = SEEDS.length;

export function createDemoUserStories(now: string): UserStory[] {
  return SEEDS.map((seed) => {
    const id = `us_demo_${String(seed.n).padStart(3, '0')}`;
    const criteria: AcceptanceCriterion[] = seed.criteria.map((c, i) => ({
      id: `${id}_ac${i + 1}`,
      number: i + 1,
      title: c.title,
      given: c.given,
      when: c.when,
      then: c.then,
      notes: c.notes ?? '',
      verification: c.verification ?? 'not-tested',
    }));
    return {
      id,
      identifier: `US-${String(seed.n).padStart(3, '0')}`,
      title: seed.title,
      persona: { ...seed.persona },
      need: seed.need,
      benefit: seed.benefit,
      description: seed.description ?? '',
      requirementIds: [...seed.requirements],
      priority: seed.priority,
      status: seed.status,
      criteria,
      criterionSequence: criteria.length,
      createdAt: now,
      updatedAt: now,
    };
  });
}
