import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { CampaignMonitorPage } from './campaign-monitor-page';

describe('CampaignMonitorPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: CampaignMonitorPage;
  let fixture: ComponentFixture<CampaignMonitorPage>;
  let data: MockDataService;

  async function create(id: string): Promise<void> {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CampaignMonitorPage],
      providers: [
        provideRouter([]),
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

    fixture = TestBed.createComponent(CampaignMonitorPage);
    fixture.componentRef.setInput('id', id);
    component = fixture.componentInstance;
    fixture.detectChanges();
    data = TestBed.inject(MockDataService);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // Clears the polling interval the page started in its constructor.
    fixture.destroy();
  });

  it('reads the campaign, its rates and its delivery series', async () => {
    await create('tenant-1-camp-1');

    const campaign = component['campaign']();
    expect(campaign).not.toBeNull();
    expect(component['missing']()).toBe(false);
    expect(component['metrics']()?.progress).toBeGreaterThan(0);
    expect(component['samples']().length).toBeGreaterThan(0);
    expect(component['chart']().length).toBe(component['samples']().length);

    // Bars are percentages of the busiest sample, so the tallest is 100.
    const tallest = Math.max(...component['chart']().map((column) => column.sent));
    expect(tallest).toBe(100);
    for (const column of component['chart']()) {
      expect(column.delivered).toBeLessThanOrEqual(column.sent);
      expect(column.read).toBeLessThanOrEqual(column.delivered);
    }
  });

  it('shows the not-found state for an unknown id', async () => {
    await create('tenant-1-camp-99');

    expect(component['missing']()).toBe(true);
    expect(component['campaign']()).toBeNull();
  });

  it('polls a sending broadcast forward and records a sample', async () => {
    await create('tenant-1-camp-1');
    TestBed.inject(SessionService).loginAs('admin');

    const campaign = await data.createCampaign({
      name: 'Monitored send',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 5000,
    });
    fixture.componentRef.setInput('id', campaign.id);
    fixture.detectChanges();
    await data.startCampaign(campaign.id);

    const samplesBefore = data.samplesFor(campaign.id).length;
    const sentBefore = data.campaignById(campaign.id)!.sent;

    await component['poll']();

    expect(data.campaignById(campaign.id)!.sent).toBeGreaterThan(sentBefore);
    expect(data.samplesFor(campaign.id).length).toBe(samplesBefore + 1);
    expect(component['ticks']()).toBe(1);

    // A second poll keeps the line moving.
    await component['poll']();
    expect(component['ticks']()).toBe(2);
    expect(data.samplesFor(campaign.id).length).toBe(samplesBefore + 2);
  });

  it('stops polling when the operator pauses updates', async () => {
    await create('tenant-1-camp-1');

    const campaign = await data.createCampaign({
      name: 'Frozen send',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 5000,
    });
    fixture.componentRef.setInput('id', campaign.id);
    fixture.detectChanges();
    await data.startCampaign(campaign.id);

    component['toggleLive']();
    expect(component['live']()).toBe(false);

    await component['poll']();

    expect(component['ticks']()).toBe(0);
    expect(data.campaignById(campaign.id)!.sent).toBe(0);
  });

  it('leaves a broadcast that is not sending alone', async () => {
    await create('tenant-1-camp-1');

    const campaign = await data.createCampaign({
      name: 'Draft on the monitor',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 500,
    });
    fixture.componentRef.setInput('id', campaign.id);
    fixture.detectChanges();

    await component['poll']();

    expect(component['ticks']()).toBe(0);
    expect(data.campaignById(campaign.id)!.status).toBe('draft');
  });

  it('starts and pauses the broadcast it is watching', async () => {
    await create('tenant-1-camp-1');
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    const campaign = await data.createCampaign({
      name: 'Watched send',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 5000,
    });
    fixture.componentRef.setInput('id', campaign.id);
    fixture.detectChanges();

    component['ask']('start');
    await component['confirm']();
    expect(data.campaignById(campaign.id)?.status).toBe('sending');
    expect(component['notice']()).toContain('Watched send');

    component['ask']('pause');
    await component['confirm']();
    expect(data.campaignById(campaign.id)?.status).toBe('paused');
  });

  it('lists the audit trail this broadcast produced', async () => {
    await create('tenant-1-camp-1');

    const campaign = await data.createCampaign({
      name: 'Audited send',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 500,
    });
    fixture.componentRef.setInput('id', campaign.id);
    fixture.detectChanges();

    expect(component['activity']().some((event) => event.action.includes('Audited send'))).toBe(true);
  });
});
