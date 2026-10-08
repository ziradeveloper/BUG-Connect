import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeader } from '../../shared/site-header/site-header';

type IssueTone = 'danger' | 'warning' | 'info' | 'success';

/** A row in the Team Inbox mock shown beside the hero copy. */
type PreviewConversation = {
  owner: string;
  summary: string;
  status: string;
  tone: IssueTone;
};

/** Modules named exactly as the PRD product vocabulary requires. */
type WorkspaceModule = {
  name: string;
  purpose: string;
  detail: string;
  points: string[];
};

type SupportingModule = {
  name: string;
  purpose: string;
};

/** The five nodes of the Flow-First message pipeline. */
type FlowNode = {
  number: string;
  title: string;
  description: string;
};

type Differentiator = {
  legacy: string;
  platform: string;
  description: string;
};

type RoleRow = {
  capability: string;
  administrator: string;
  supervisor: string;
  agent: string;
};

type Industry = {
  priority: string;
  name: string;
  useCase: string;
};

type OnboardingStep = {
  number: string;
  title: string;
  description: string;
};

type Assurance = {
  title: string;
  description: string;
};

type LandingPlan = {
  name: string;
  audience: string;
  description: string;
  features: string[];
  featured: boolean;
};

type LandingFaq = {
  question: string;
  answer: string;
};

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, SiteHeader],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  /** Named so the existing hero preview markup keeps working. */
  protected readonly previewConversations: PreviewConversation[] = [
    { owner: 'Flow', summary: 'Menu sent · customer picked “Order status”', status: 'Flow', tone: 'info' },
    { owner: 'Ravi', summary: '2 kg mint halwa for Saturday — confirm by 6 pm', status: 'Open', tone: 'warning' },
    { owner: 'Ravi', summary: 'Waiting on counter stock check · internal note added', status: 'Pending', tone: 'danger' },
    { owner: 'Meena', summary: 'Invoice PDF delivered through the Tally bridge', status: 'Resolved', tone: 'success' },
  ];

  protected readonly heroStats = [
    { value: 'Unlimited', label: 'human agent seats on every plan' },
    { value: '<150 ms', label: 'webhook acknowledged, then queued for processing' },
    { value: 'One', label: 'official WhatsApp number, operated by your whole team' },
  ];

  protected readonly inboxQueues = ['Unassigned', 'Mine', 'Open', 'Resolved'];

  protected readonly differentiators: Differentiator[] = [
    {
      legacy: 'Per-seat licensing',
      platform: 'Zero seat fees',
      description:
        'Legacy tools charge every agent a monthly seat. WABAFlow keeps agent seats unlimited and scales with volume and active contacts instead.',
    },
    {
      legacy: 'An inbox everyone shares',
      platform: 'Flow-First triage',
      description:
        'Incoming conversations are qualified by the Flow Engine first, so a person only sees chats that already have context, a department, and an owner.',
    },
    {
      legacy: 'Links out to a web form',
      platform: 'Native WhatsApp Flows',
      description:
        'Appointments, enquiries and quotations are captured in multi-screen forms that stay inside WhatsApp — built visually, without hand-writing JSON.',
    },
    {
      legacy: 'Cloud-only integrations',
      platform: 'Local desktop ERP bridge',
      description:
        'A lightweight sync client watches folders for Tally, Marg and Vyapar exports, then delivers invoices, balance alerts and ledger PDFs to the customer.',
    },
    {
      legacy: 'Generic English dashboards',
      platform: 'Localized operations',
      description:
        'Tamil interface options for support staff, on-site onboarding, and initial flow and template setup delivered as a service, not a ticket.',
    },
    {
      legacy: 'One shared multi-tenant app',
      platform: 'Isolated workspace',
      description:
        'Each business runs on its own subdomain with logically isolated data, so a tenant only ever queries its own contacts, threads and templates.',
    },
  ];

  protected readonly flowNodes: FlowNode[] = [
    {
      number: '01',
      title: 'Inbound customer hook',
      description:
        'The webhook receives the message, identifies the sender as a new or returning contact, and starts the workspace default flow when no conversation is active.',
    },
    {
      number: '02',
      title: 'Interactive menu or template',
      description:
        'A Meta-approved message offers up to three quick-reply buttons or a ten-option list: browse the catalogue, track an order, or talk to a person.',
    },
    {
      number: '03',
      title: 'Selection evaluation',
      description:
        'Self-service paths return business information, maps or catalogue links. An escalation choice takes the conversation down the handoff branch instead.',
    },
    {
      number: '04',
      title: 'Weighted agent router',
      description:
        'Online agents are compared against their configured chat limit, and the chat goes to whoever has the lowest active load — then a live event reaches their desk.',
    },
    {
      number: '05',
      title: 'Conversation close',
      description:
        'Resolution frees the agent capacity, records the outcome for analytics, optionally triggers a follow-up survey, and archives the thread context.',
    },
  ];

  protected readonly modules: WorkspaceModule[] = [
    {
      name: 'Team Inbox',
      purpose: 'A shared real-time workspace for customer conversations.',
      detail:
        'The operational destination of the flow, not a separate chat screen. Live synchronization, queues, assignment, internal notes and saved replies.',
      points: [
        'Unassigned, Mine, Open and Resolved queues',
        'Assignment, reassignment and team routing',
        'Typing and active-view indicators',
        'Private internal notes and saved replies',
      ],
    },
    {
      name: 'Flow Builder',
      purpose: 'A no-code visual automation designer.',
      detail:
        'Administrators and supervisors design the customer journey on a canvas, from first greeting to handoff, without asking engineering for a change.',
      points: [
        'Trigger, message and interactive menu nodes',
        'Conditions on hours, tags and lead status',
        'Data collection and tagging actions',
        'Human handoff as a first-class node',
      ],
    },
    {
      name: 'WhatsApp Flows Studio',
      purpose: 'Designer for native WhatsApp multi-screen forms.',
      detail:
        'Structured inputs that customers complete inside WhatsApp, with validation before submission and a visual preview before publishing.',
      points: [
        'Text, selection, date and confirmation inputs',
        'Required-field validation before submission',
        'Submissions land in the conversation or flow',
        'Reuse for bookings, quotes and registrations',
      ],
    },
    {
      name: 'Template Manager',
      purpose: 'Lifecycle and synchronization for approved templates.',
      detail:
        'A central catalogue of message templates with status tracking, organized by category and language, and kept in step with the business Meta assets.',
      points: [
        'Template catalogue with status tracking',
        'Category and language organization',
        'Variable management before submission',
        'Selectable in campaigns and flows',
      ],
    },
    {
      name: 'Campaign Manager',
      purpose: 'Audience creation, broadcast scheduling and monitoring.',
      detail:
        'Outbound is paced deliberately. Segments are built from tags and attributes, and delivery is monitored without pushing an account past its limits.',
      points: [
        'Segmentation by tags and business rules',
        'Preview, schedule and launch controls',
        'Pacing against platform limits and account health',
        'Sent, delivered, read, failed and replied outcomes',
      ],
    },
    {
      name: 'Contact Hub',
      purpose: 'Contacts, tags, segments and consent in one directory.',
      detail:
        'Every customer carries the profile, history and communication preference that the rest of the workspace acts on, including the opt-out list.',
      points: [
        'WhatsApp number, identifiers and attributes',
        'Tags, segments and lead or customer status',
        'Full conversation and campaign history',
        'Opt-out status enforced on marketing sends',
      ],
    },
  ];

  protected readonly supportingModules: SupportingModule[] = [
    { name: 'Workspace Administration', purpose: 'Business profile, subscription, users, WhatsApp settings' },
    { name: 'Flow Engine', purpose: 'Executes published journeys and advances each conversation state' },
    { name: 'Developer Hub', purpose: 'Scoped API keys, webhooks, documentation, Postman export' },
    { name: 'Integration Bridge', purpose: 'Controlled connection to local business systems' },
    { name: 'Analytics & Insights', purpose: 'Executive, team, automation, campaign and contact reporting' },
    { name: 'Admin Console', purpose: 'Platform-side tenants, plans and support operations' },
  ];

  protected readonly roles: { name: string; scope: string }[] = [
    { name: 'Workspace Administrator', scope: 'Owns the client workspace' },
    { name: 'Supervisor', scope: 'Agents, queues, flows and operations' },
    { name: 'Support Agent', scope: 'Assigned customer conversations' },
    { name: 'Developer / Integration User', scope: 'Approved API integrations only' },
  ];

  protected readonly roleMatrix: RoleRow[] = [
    { capability: 'Manage WhatsApp connection', administrator: 'Yes', supervisor: 'No', agent: 'No' },
    { capability: 'Manage subscription and billing', administrator: 'Yes', supervisor: 'No', agent: 'No' },
    { capability: 'Manage users and roles', administrator: 'Yes', supervisor: 'Limited', agent: 'No' },
    {
      capability: 'Build and publish flows',
      administrator: 'Yes',
      supervisor: 'Yes',
      agent: 'View / as permitted',
    },
    { capability: 'Manage templates', administrator: 'Yes', supervisor: 'Yes', agent: 'View / use' },
    { capability: 'Create campaigns', administrator: 'Yes', supervisor: 'Yes', agent: 'No' },
    {
      capability: 'Use the Team Inbox',
      administrator: 'All conversations',
      supervisor: 'Team conversations',
      agent: 'Assigned / permitted',
    },
    { capability: 'Internal notes', administrator: 'Yes', supervisor: 'Yes', agent: 'Yes' },
    {
      capability: 'View analytics',
      administrator: 'Full',
      supervisor: 'Team / operational',
      agent: 'Personal / permitted',
    },
    { capability: 'Developer credentials', administrator: 'Yes', supervisor: 'View if permitted', agent: 'No' },
  ];

  protected readonly industries: Industry[] = [
    {
      priority: '01',
      name: 'Sweets, bakeries and packaged foods',
      useCase: 'Orders, catalogue enquiries, repeat marketing and delivery updates.',
    },
    {
      priority: '02',
      name: 'Textile, silk and bridal retail',
      useCase: 'Product enquiries, appointment booking, rich media catalogues and sales handoff.',
    },
    {
      priority: '03',
      name: 'Diagnostic centres and clinics',
      useCase: 'Appointments, report notifications, service enquiries and department routing.',
    },
    {
      priority: '04',
      name: 'Coaching and educational institutes',
      useCase: 'Lead qualification, course enquiries and counselling appointments.',
    },
  ];

  protected readonly onboarding: OnboardingStep[] = [
    { number: '01', title: 'Interest or invitation', description: 'A business expresses interest or is invited to start.' },
    { number: '02', title: 'Workspace created', description: 'The platform provisions the business workspace.' },
    { number: '03', title: 'Admin access issued', description: 'The administrator receives a workspace URL and access.' },
    { number: '04', title: 'Profile and subscription', description: 'Business profile and subscription setup are completed.' },
    {
      number: '05',
      title: 'WhatsApp connection',
      description: 'The official business account is connected through Meta’s supported onboarding.',
    },
    { number: '06', title: 'Assets synchronized', description: 'The number and required WhatsApp assets are pulled in.' },
    { number: '07', title: 'Staff and roles', description: 'Administrators add team members and assign permissions.' },
    { number: '08', title: 'Templates and flows', description: 'Initial approved templates and automated flows are configured.' },
    { number: '09', title: 'Team testing', description: 'Staff practice customer conversations before going live.' },
    { number: '10', title: 'Workspace live', description: 'The business starts handling enquiries from one console.' },
  ];

  protected readonly tenantLifecycle = [
    'Lead / trial',
    'Onboarding',
    'WhatsApp connection pending',
    'Active',
    'Suspended',
    'Cancelled / archived',
  ];

  protected readonly assurances: Assurance[] = [
    {
      title: 'Tenant isolation by policy',
      description:
        'Requests resolve a tenant from the subdomain, and data access is filtered to that identifier — one business cannot read another workspace.',
    },
    {
      title: 'Role-based staff access',
      description: 'Administrator, supervisor and agent capabilities are separated across every module, including exports and credentials.',
    },
    {
      title: 'Guarded Meta credentials',
      description: 'Access tokens and integration secrets are handled as encrypted values and never exposed in client responses.',
    },
    {
      title: 'Signed, queued webhooks',
      description:
        'Incoming events are signature-validated and acknowledged immediately, then processed asynchronously so a traffic spike never delays the platform.',
    },
    {
      title: 'Opt-out enforcement',
      description: 'Contact consent is checked before marketing sends, so an opted-out customer is excluded from future campaigns.',
    },
    {
      title: 'Auditable administration',
      description: 'Important administrative actions are recorded, alongside backups, recovery procedures and delivery monitoring.',
    },
  ];

  protected readonly planDimensions = [
    'Active staff users',
    'Connected WhatsApp numbers',
    'Published flows',
    'Campaign access and monthly usage',
    'Contact capacity',
    'Automation node depth',
    'Developer API limits',
    'Analytics retention',
    'Support tier',
  ];

  protected readonly plans: LandingPlan[] = [
    {
      name: 'Pilot',
      audience: 'For a first measurable rollout',
      description: 'The Phase 1 foundation, run with one focused automation journey and a small group of staff.',
      features: [
        'Isolated workspace on its own subdomain',
        'Official WhatsApp connection and onboarding support',
        'Team Inbox with roles, queues and internal notes',
        'First Flow Engine version and basic templates',
      ],
      featured: false,
    },
    {
      name: 'Growth',
      audience: 'For daily operations at volume',
      description: 'Adds outbound campaigns and template lifecycle so marketing and support run from the same console.',
      features: [
        'Everything in Pilot',
        'Flow Builder with branching and data capture',
        'Campaign Manager with pacing and opt-out control',
        'Template Manager synchronization and operational analytics',
      ],
      featured: true,
    },
    {
      name: 'Scale',
      audience: 'For connected systems and teams',
      description: 'Structured collection and external connectivity layered on without changing the core model.',
      features: [
        'WhatsApp Flows Studio for native forms',
        'Developer Hub with scoped keys and webhooks',
        'Integration Bridge for local desktop accounting',
        'Tamil interface options and deeper reporting',
      ],
      featured: false,
    },
  ];

  protected readonly faqs: LandingFaq[] = [
    {
      question: 'Do we need a new WhatsApp number?',
      answer:
        'The workspace connects your official business account through Meta’s supported onboarding process, and the business admin manages that connection. The exact account-ownership model is one of the decisions being finalized before engineering starts.',
    },
    {
      question: 'What happens when a customer asks for a person?',
      answer:
        'Human handoff is a flow node, not an afterthought. The router filters online agents, reads each one’s chat capacity, and assigns the conversation to whoever has the lowest load, then raises a real-time event at that desk.',
    },
    {
      question: 'Is bulk marketing safe for our account?',
      answer:
        'Campaigns are paced against platform limits and account health rather than fired at full speed. Opt-outs are processed and enforced, and delivery, read, failure and reply outcomes are monitored per campaign.',
    },
    {
      question: 'Can it connect to Tally, Marg or Vyapar?',
      answer:
        'That is the Integration Bridge: a lightweight local client watches agreed folders for exports, extracts what it needs, and returns documents such as invoices and balance alerts to the customer conversation.',
    },
    {
      question: 'Is our data separate from other businesses?',
      answer:
        'Yes. Each business is a tenant with its own users, WhatsApp configuration, contacts, threads, templates, flows and credentials, kept logically isolated and enforced at the data layer.',
    },
    {
      question: 'Can staff use it without technical training?',
      answer:
        'The product ships with a non-developer operating guide for administrators, agents and supervisors, and onboarding includes initial flow and template setup done with you on site.',
    },
    {
      question: 'How is success measured?',
      answer:
        'Active workspaces and agents, first response and resolution time, automation completion and handoff rate, campaign delivery and opt-out rates, and time from signup to the first successful live conversation.',
    },
    {
      question: 'What will a plan cost?',
      answer:
        'Pricing is not published yet. Plans will be metered on practical business limits rather than message count alone, and final numbers still need validating against Meta charges, infrastructure cost and the level of local onboarding included.',
    },
  ];
}
