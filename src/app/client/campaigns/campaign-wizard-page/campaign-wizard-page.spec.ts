import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { CampaignWizardPage } from './campaign-wizard-page';

/** Stands in for the monitor screen the wizard navigates to on create. */
@Component({ selector: 'app-blank', template: '' })
class BlankMonitorPage {}

describe('CampaignWizardPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: CampaignWizardPage;
  let fixture: ComponentFixture<CampaignWizardPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CampaignWizardPage],
      providers: [
        provideRouter([{ path: 'campaigns/:id', component: BlankMonitorPage }]),
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: computed(() => resolution().kind),
            slug: computed(() => resolution().slug),
            isPlatform: computed(() => resolution().kind === 'platform'),
            isClient: computed(() => resolution().kind === 'client'),
            isMarketing: computed(() => resolution().kind === 'marketing'),
            isWorkspace: computed(() => resolution().kind !== 'marketing'),
            displayName: computed(() => 'Nazeel Silks & Bridal'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignWizardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    data = TestBed.inject(MockDataService);
  });

  /** The segment with the widest match, so the wizard always has recipients. */
  function widestSegmentId(): string {
    const segments = component['segments']();
    const widest = segments.reduce((best, row) => (row.count > best.count ? row : best));
    return widest.id;
  }

  it('evaluates the audience live from the chosen segment', () => {
    const id = widestSegmentId();

    component['setSegment'](id);

    expect(component['segment']()?.id).toBe(id);
    expect(component['audience']().length).toBe(
      component['segments']().find((row) => row.id === id)?.count,
    );
    expect(component['audienceSample']().length).toBeGreaterThan(0);
  });

  it('walks the steps in order and blocks an unfinished one', () => {
    expect(component['step']()).toBe(1);

    component['next']();
    expect(component['step']()).toBe(1); // no name, no segment
    expect(component['issues']().some((issue) => issue.includes('Name the campaign'))).toBe(true);

    component['name'].set('Diwali preview');
    component['setSegment'](widestSegmentId());
    component['next']();
    expect(component['step']()).toBe(2);

    component['back']();
    expect(component['step']()).toBe(1);
    component['goTo'](1);
    expect(component['step']()).toBe(1);
  });

  it('offers only approved templates and seeds their sample values', () => {
    for (const template of component['templates']()) {
      expect(template.status).toBe('approved');
    }

    const template = component['templates']().find((row) => row.variables > 0)!;
    component['setTemplate'](template.id);

    expect(component['variableIndexes']().length).toBe(template.variables);
    expect(component['sampleFor'](1)).toBe(template.variableLabels?.[0]);
    expect(component['sourceFor'](1)).toBe('sample');
  });

  it('renders the preview with the mapped samples', () => {
    const template = component['templates']().find((row) => row.variables > 0)!;
    component['setTemplate'](template.id);
    component['setSample'](1, 'Aarthi');

    expect(component['previewBody']()).toContain('Aarthi');
    expect(component['previewBody']()).not.toContain('{{1}}');
    expect(component['sourceLabel'](1)).toContain('Fixed text');

    component['setSource'](1, 'name');
    expect(component['sourceLabel'](1)).toBe('Contact name');
  });

  it('requires a schedule time in the future', () => {
    component['name'].set('Scheduled send');
    component['setSegment'](widestSegmentId());
    component['when'].set('later');
    component['scheduledLocal'].set('2020-01-01T09:00');

    expect(component['stepIssues']()[4]?.some((issue) => issue.includes('past'))).toBe(true);

    component['scheduledLocal'].set(new Date(Date.now() + 7_200_000).toISOString().slice(0, 16));
    expect(component['scheduleIso']()).not.toBeNull();
    expect(component['stepIssues']()[4]?.some((issue) => issue.includes('past'))).toBe(false);
  });

  it('creates the broadcast and hands it to the sender', async () => {
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    const template = component['templates']()[0]!;
    component['name'].set('Pongal catalogue');
    component['pacePerHour'].set(1200);
    component['setSegment'](widestSegmentId());
    component['setTemplate'](template.id);

    const audienceSize = component['audience']().length;
    await component['finish'](true);

    const created = data.campaigns().find((row) => row.name === 'Pongal catalogue')!;
    expect(created).toBeTruthy();
    expect(created.templateId).toBe(template.id);
    expect(created.audienceSize).toBe(audienceSize);
    expect(created.status).toBe('sending');
    expect(
      data
        .auditForTenant(data.tenantId())
        .some((event) => event.area === 'campaigns' && event.action.includes('Pongal catalogue')),
    ).toBe(true);
  });

  it('saves a draft without starting it', async () => {
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    component['name'].set('Held back');
    component['setSegment'](widestSegmentId());
    component['setTemplate'](component['templates']()[0]!.id);

    await component['finish'](false);

    const created = data.campaigns().find((row) => row.name === 'Held back')!;
    expect(created.status).toBe('draft');
    expect(created.sent).toBe(0);
  });

  it('refuses to create a broadcast without an audience or a template', async () => {
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    component['name'].set('Incomplete');
    await component['finish'](false);

    expect(data.campaigns().some((row) => row.name === 'Incomplete')).toBe(false);
    expect(component['error']()).toBeTruthy();
  });
});
