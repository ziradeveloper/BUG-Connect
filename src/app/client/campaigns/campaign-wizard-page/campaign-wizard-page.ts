import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { renderTemplateBody } from '../../../core/data/whatsapp';
import { formatDateTime, formatNumber } from '../../../shared/format';
import { PageHeader } from '../../../shared/ui/ui';

/** Where a template variable's value comes from at send time. */
type VariableSource = 'sample' | 'name' | 'phone' | 'tag';

const PACE_OPTIONS = [120, 250, 500, 1000];

const SOURCE_LABELS: Record<VariableSource, string> = {
  sample: 'Fixed text (same for everyone)',
  name: 'Contact name',
  phone: 'Contact WhatsApp number',
  tag: 'First contact tag',
};

/**
 * Campaign Broadcast Wizard (`/campaigns/new`, wave 6).
 *
 * Four steps over real records: the audience is a saved segment evaluated live
 * (the count on the card is the count that will be sent to), the template is an
 * approved one only, variables are mapped to contact fields with a rendered
 * preview, and the last step checks the plan's monthly allowance before anything
 * is created. Creating writes a draft; starting it is a separate, confirmed act.
 */
@Component({
  selector: 'app-campaign-wizard-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './campaign-wizard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignWizardPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly step = signal(1);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);

  protected readonly paceOptions = PACE_OPTIONS;

  /** Where a variable's value can come from at send time. */
  protected readonly sourceOptions = (
    Object.keys(SOURCE_LABELS) as VariableSource[]
  ).map((id) => ({ id, label: SOURCE_LABELS[id] }));
  protected readonly formatNumber = formatNumber;
  protected readonly sourceLabels = SOURCE_LABELS;

  protected readonly canManage = computed(() => this.permissions.can('campaigns.manage', 'edit'));

  /**
   * The draft, one signal per field: the audience, the preview and the review
   * are all computeds over these, so a plain object would leave them stale.
   */
  protected readonly name = signal('');
  protected readonly segmentId = signal('');
  protected readonly templateId = signal('');
  protected readonly pacePerHour = signal(250);

  protected readonly when = signal<'now' | 'later'>('now');
  protected readonly scheduledLocal = signal('');

  /** Per-variable sample value and source, keyed by the 1-based placeholder. */
  protected readonly samples = signal<Record<number, string>>({});
  protected readonly sources = signal<Record<number, VariableSource>>({});

  protected readonly segments = computed(() =>
    this.data.segments().map((segment) => ({
      ...segment,
      count: this.data.evaluateSegment(segment.match, segment.rules).length,
    })),
  );

  protected readonly segment = computed(
    () => this.data.segments().find((row) => row.id === this.segmentId()) ?? null,
  );

  protected readonly audience = computed(() => {
    const segment = this.segment();
    return segment ? this.data.evaluateSegment(segment.match, segment.rules) : [];
  });

  /** A handful of real recipients, so the count is never an abstraction. */
  protected readonly audienceSample = computed(() => this.audience().slice(0, 5));

  protected readonly optedOut = computed(
    () => this.audience().filter((contact) => !contact.optInStatus).length,
  );

  protected readonly templates = computed(() =>
    this.data.templates().filter((template) => template.status === 'approved'),
  );

  protected readonly template = computed(
    () => this.data.templates().find((row) => row.id === this.templateId()) ?? null,
  );

  /** 1-based placeholders the chosen template carries. */
  protected readonly variableIndexes = computed<number[]>(() => {
    const template = this.template();
    if (!template) {
      return [];
    }
    return Array.from({ length: template.variables }, (_, index) => index + 1);
  });

  protected sampleFor(index: number): string {
    const typed = this.samples()[index];
    if (typed !== undefined && typed !== '') {
      return typed;
    }
    return this.template()?.variableLabels?.[index - 1] ?? '';
  }

  protected sourceFor(index: number): VariableSource {
    return this.sources()[index] ?? 'sample';
  }

  protected setSample(index: number, value: string): void {
    this.samples.update((current) => ({ ...current, [index]: value }));
  }

  protected setSource(index: number, value: VariableSource): void {
    this.sources.update((current) => ({ ...current, [index]: value }));
  }

  /** The body exactly as a recipient would read it, with the samples filled in. */
  protected readonly previewBody = computed(() => {
    const template = this.template();
    if (!template) {
      return '';
    }
    return renderTemplateBody(
      template.body,
      this.variableIndexes().map((index) => this.sampleFor(index)),
    );
  });

  protected readonly allowance = computed(() => {
    const tier = this.data.currentTenant()?.subscriptionTier ?? 'Pilot';
    const limit = this.data.planForTier(tier)?.limits.campaignsPerMonth ?? null;
    const used = this.data.planUsage().campaignsPerMonth;
    return { tier, limit, used, exhausted: limit !== null && used >= limit };
  });

  protected readonly scheduleIso = computed(() => {
    if (this.when() === 'now') {
      return null;
    }
    const value = this.scheduledLocal();
    if (!value) {
      return null;
    }
    const stamp = Date.parse(value);
    return Number.isNaN(stamp) ? null : new Date(stamp).toISOString();
  });

  protected readonly etaMinutes = computed(() => {
    const pace = this.pacePerHour();
    const size = this.audience().length;
    return pace > 0 ? Math.max(1, Math.round((size / pace) * 60)) : 0;
  });

  protected readonly stepIssues = computed<Record<number, string[]>>(() => ({
    1: [
      ...(!this.name().trim() ? ['Name the campaign.'] : []),
      ...(!this.segment() ? ['Pick the audience segment to send to.'] : []),
      ...(this.segment() && this.audience().length === 0
        ? ['That segment matches nobody — the broadcast would send nothing.']
        : []),
    ],
    2: [...(!this.template() ? ['Pick an approved template.'] : [])],
    3: [
      ...this.variableIndexes()
        .filter((index) => this.sourceFor(index) === 'sample' && !this.sampleFor(index).trim())
        .map((index) => `Variable {{${index}}} has no text.`),
    ],
    4: [
      ...(this.when() === 'later' && !this.scheduleIso()
        ? ['Pick a date and time, or send now.']
        : []),
      ...(this.when() === 'later' &&
      this.scheduleIso() &&
      Date.parse(this.scheduleIso() as string) <= Date.now()
        ? ['That time is already in the past.']
        : []),
      ...(this.optedOut() > 0
        ? [`${this.optedOut()} recipients in this segment have opted out and will be skipped.`]
        : []),
    ],
  }));

  protected readonly issues = computed(() => this.stepIssues()[this.step()] ?? []);

  protected readonly blockers = computed(() =>
    Object.values(this.stepIssues())
      .flat()
      .filter((issue) => !issue.includes('opted out')),
  );

  protected readonly steps = [
    { n: 1, label: 'Audience' },
    { n: 2, label: 'Template' },
    { n: 3, label: 'Variables' },
    { n: 4, label: 'Schedule' },
  ];

  protected next(): void {
    this.attempted.set(true);
    if ((this.stepIssues()[this.step()] ?? []).some((issue) => !issue.includes('opted out'))) {
      return;
    }
    this.step.update((current) => Math.min(4, current + 1));
  }

  protected back(): void {
    this.step.update((current) => Math.max(1, current - 1));
  }

  protected goTo(step: number): void {
    if (step < this.step()) {
      this.step.set(step);
    }
  }

  protected setSegment(segmentId: string): void {
    this.segmentId.set(segmentId);
  }

  protected setTemplate(templateId: string): void {
    if (this.templateId() === templateId) {
      return;
    }
    this.templateId.set(templateId);
    // Seed the inputs with the template's own sample values so the preview
    // reads like a real message before anyone types.
    const template = this.data.templates().find((row) => row.id === templateId);
    this.samples.set(
      Object.fromEntries(
        (template?.variableLabels ?? []).map((value, index) => [index + 1, value] as const),
      ),
    );
    this.sources.set({});
  }

  /** Create the broadcast; optionally hand it straight to the sender. */
  protected async finish(start: boolean): Promise<void> {
    this.attempted.set(true);
    if (this.blockers().length) {
      this.error.set(this.blockers()[0] as string);
      return;
    }
    if (!this.canManage()) {
      this.error.set('You need campaign edit rights to create a broadcast.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const campaign = await this.data.createCampaign({
        name: this.name(),
        segmentId: this.segmentId() || null,
        templateId: this.templateId() || null,
        pacePerHour: this.pacePerHour(),
        scheduledAt: this.scheduleIso(),
        audienceSize: this.audience().length,
      });

      if (start) {
        const started = await this.data.startCampaign(campaign.id);
        if (!started) {
          this.error.set('The draft was saved but could not start.');
        }
      }

      await this.router.navigate(['/campaigns', campaign.id]);
    } finally {
      this.saving.set(false);
    }
  }

  protected scheduleLabel(): string {
    const iso = this.scheduleIso();
    return iso ? formatDateTime(iso) : 'Immediately, at the chosen pace';
  }

  protected sourceLabel(index: number): string {
    return SOURCE_LABELS[this.sourceFor(index)];
  }
}
