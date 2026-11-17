/**
 * Core data model for the toolkit.
 *
 * The workspace is the single root aggregate that is persisted. Each module
 * owns one slice of it. Later phases (process analysis, requirements, user
 * stories, risks) add further slices that reference stakeholders by `id`.
 */

/** Three-point rating used for stakeholder interest and influence. */
export type Level = 'low' | 'medium' | 'high';

export const LEVELS: readonly Level[] = ['low', 'medium', 'high'];

export const LEVEL_LABELS: Record<Level, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** A project objective. Has a stable id so requirements can trace to it (schema v3). */
export interface Objective {
  id: string;
  text: string;
}

export interface ProjectOverview {
  name: string;
  /** Organisation or business unit the project is run for. */
  organisation: string;
  background: string;
  problemStatement: string;
  objectives: Objective[];
  inScope: string[];
  outOfScope: string[];
  successCriteria: string[];
  /** ISO timestamp of the last saved change, or null if never edited. */
  updatedAt: string | null;
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  description: string;
  interest: Level;
  influence: Level;
  expectations: string[];
  createdAt: string;
  updatedAt: string;
}

/** Fields a user can edit on a stakeholder (identity and audit fields excluded). */
export type StakeholderInput = Pick<
  Stakeholder,
  'name' | 'role' | 'description' | 'interest' | 'influence' | 'expectations'
>;

export type DataOrigin = 'demo' | 'blank';

export interface WorkspaceMeta {
  /** How the workspace was initialised; drives the demo-data notice. */
  origin: DataOrigin;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Process analysis (schema v2)
// ---------------------------------------------------------------------------

export type ProcessType = 'as-is' | 'to-be';

/**
 * How a TO-BE step relates to the AS-IS baseline. Always recorded explicitly
 * by the analyst; the comparison never infers it.
 */
export type StepChange = 'unchanged' | 'modified' | 'new' | 'automated';

/** Who performs a step: a stakeholder from the register, or a free-text role. */
export type Responsibility = { type: 'stakeholder'; stakeholderId: string } | { type: 'role'; role: string };

export interface ProcessStep {
  id: string;
  /** Activity name. The step number is its position in `BusinessProcess.steps`. */
  name: string;
  description: string;
  responsible: Responsibility;
  input: string;
  output: string;
  /** Optional decision or condition evaluated in this step ('' when none). */
  decision: string;
  notes: string;
  /** TO-BE steps only (null for AS-IS). */
  change: StepChange | null;
  /** TO-BE steps only: IDs of the baseline AS-IS steps this step corresponds to. */
  sourceStepIds: string[];
}

export interface BusinessProcess {
  id: string;
  type: ProcessType;
  name: string;
  description: string;
  objective: string;
  trigger: string;
  startCondition: string;
  endCondition: string;
  /** TO-BE only: the AS-IS process this design improves on, used for comparison. */
  baselineProcessId: string | null;
  steps: ProcessStep[];
  createdAt: string;
  updatedAt: string;
}

/** A problem in an AS-IS step. */
export interface Bottleneck {
  id: string;
  stepId: string;
  title: string;
  description: string;
  impact: string;
  severity: Level;
  suggestedImprovement: string;
  createdAt: string;
  updatedAt: string;
}

/** A proposed improvement delivered by a TO-BE step. */
export interface Improvement {
  id: string;
  stepId: string;
  title: string;
  description: string;
  relatedProblem: string;
  expectedBenefit: string;
  priority: Level;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Requirements (schema v3)
// ---------------------------------------------------------------------------

export type RequirementType = 'functional' | 'non-functional';

/** MoSCoW priority. */
export type RequirementPriority = 'must' | 'should' | 'could' | 'wont';

export type RequirementStatus =
  | 'draft'
  | 'proposed'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'implemented'
  | 'deferred';

export interface Requirement {
  id: string;
  /** Human-readable identifier, e.g. FR-001. Assigned once and never reused. */
  identifier: string;
  /** Fixed at creation so the identifier prefix always matches. */
  type: RequirementType;
  /** Category id from the configured list for the requirement type. */
  category: string;
  title: string;
  description: string;
  rationale: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  sourceStakeholderId: string | null;
  objectiveIds: string[];
  /** Process step ids (AS-IS or TO-BE). */
  stepIds: string[];
  /** Requirements this one depends on. */
  dependencyIds: string[];
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
}

/** Last issued identifier number per type; identifiers are never reused after deletion. */
export interface RequirementSequence {
  functional: number;
  nonFunctional: number;
}

// ---------------------------------------------------------------------------
// User stories and acceptance criteria (schema v4)
// ---------------------------------------------------------------------------

export type StoryStatus =
  | 'draft'
  | 'proposed'
  | 'under-review'
  | 'approved'
  | 'ready'
  | 'implemented'
  | 'deferred';

/** Documentation of verification outcome; the toolkit does not execute tests. */
export type VerificationStatus = 'not-tested' | 'passed' | 'failed' | 'blocked';

/**
 * Who the story is for. `label` is the role wording used in the story
 * statement ("As a <label>"). `stakeholderId` links to the stakeholder
 * register; null means a custom persona that is not a stakeholder record.
 */
export interface StoryPersona {
  stakeholderId: string | null;
  label: string;
}

export interface AcceptanceCriterion {
  id: string;
  /** Stable per-story number shown as AC-<number>; never reused within the story. */
  number: number;
  title: string;
  given: string;
  when: string;
  then: string;
  notes: string;
  verification: VerificationStatus;
}

export interface UserStory {
  id: string;
  /** US-001 etc. Assigned once and never reused. */
  identifier: string;
  title: string;
  persona: StoryPersona;
  /** "I want ..." part, stored without the leading words. */
  need: string;
  /** "so that ..." part, stored without the leading words. */
  benefit: string;
  description: string;
  requirementIds: string[];
  /** Delivery priority of the story; independent of its requirements' priorities. */
  priority: RequirementPriority;
  status: StoryStatus;
  /** Ordered acceptance criteria. */
  criteria: AcceptanceCriterion[];
  /** Last acceptance-criterion number issued for this story. */
  criterionSequence: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Risk management (schema v5)
// ---------------------------------------------------------------------------

export type RiskResponse = 'avoid' | 'mitigate' | 'transfer' | 'accept';

export type RiskStatus =
  | 'identified'
  | 'under-assessment'
  | 'response-planned'
  | 'in-progress'
  | 'monitoring'
  | 'closed'
  | 'materialised';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Responsible owner: a stakeholder from the register, or a named custom owner (stakeholderId null). */
export interface RiskOwner {
  stakeholderId: string | null;
  customName: string;
}

/**
 * Optional links to existing records, for context. A risk stays valid without
 * them; when a linked record is deleted the link is removed from the risk.
 */
export interface RiskLinks {
  stakeholderIds: string[];
  objectiveIds: string[];
  /** AS-IS and TO-BE process step ids. */
  stepIds: string[];
  requirementIds: string[];
  storyIds: string[];
}

export interface Risk {
  id: string;
  /** RSK-001 etc. Assigned once and never reused. */
  identifier: string;
  title: string;
  description: string;
  /** Category id from the configured list. */
  category: string;
  /** 1 (Rare) to 5 (Almost Certain). Score and severity are derived, never stored. */
  probability: number;
  /** 1 (Insignificant) to 5 (Severe). */
  impact: number;
  response: RiskResponse;
  mitigation: string;
  contingency: string;
  owner: RiskOwner;
  status: RiskStatus;
  links: RiskLinks;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  meta: WorkspaceMeta;
  project: ProjectOverview;
  stakeholders: Stakeholder[];
  processes: BusinessProcess[];
  bottlenecks: Bottleneck[];
  improvements: Improvement[];
  requirements: Requirement[];
  requirementSequence: RequirementSequence;
  userStories: UserStory[];
  /** Last US number issued. */
  storySequence: number;
  risks: Risk[];
  /** Last RSK number issued. */
  riskSequence: number;
}

/** Field-level validation errors keyed by field name. */
export type ValidationErrors<T> = Partial<Record<keyof T, string>>;
