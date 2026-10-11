import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { CampaignsPage } from './campaigns-page';

describe('CampaignsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: CampaignsPage;
  let fixture: ComponentFixture<CampaignsPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CampaignsPage],
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

    fixture = TestBed.createComponent(CampaignsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists the workspace broadcasts and summarises delivery', () => {
    const data = TestBed.inject(MockDataService);
    const summary = component['summary']();

    expect(component['rows']().length).toBe(data.campaigns().length);
    expect(summary.total).toBe(data.campaigns().length);
    expect(summary.audience).toBe(
      data.campaigns().reduce((total, row) => total + row.audienceSize, 0),
    );
    for (const campaign of component['rows']()) {
      expect(component['progress'](campaign)).toBe(
        data.campaignMetrics(campaign.id)?.progress ?? 0,
      );
      expect(component['audienceLabel'](campaign)).toBeTruthy();
    }
  });

  it('reports the plan allowance from the live tier', () => {
    const data = TestBed.inject(MockDataService);
    const allowance = component['allowance']();

    expect(allowance.tier).toBe(data.currentTenant()?.subscriptionTier);
    expect(allowance.used).toBe(data.planUsage().campaignsPerMonth);
  });

  it('will not start a broadcast that has no template', async () => {
    const data = TestBed.inject(MockDataService);
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    const empty = await data.createCampaign({
      name: 'No template',
      segmentId: null,
      templateId: null,
      pacePerHour: 250,
      scheduledAt: null,
      audienceSize: 50,
    });

    expect(component['canStart'](empty)).toBe(false);
    expect(component['startBlocker'](empty)).toContain('template');

    component['ask'](empty, 'start');
    await component['confirm']();

    expect(data.campaignById(empty.id)?.status).toBe('draft');
    expect(component['error']()).toBeTruthy();
  });

  it('starts and pauses a broadcast through the confirmation', async () => {
    const data = TestBed.inject(MockDataService);
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();

    const campaign = await data.createCampaign({
      name: 'Festive preview',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 500,
    });

    expect(component['canStart'](campaign)).toBe(true);
    component['ask'](campaign, 'start');
    expect(component['dialogTitle']()).toContain(campaign.name);
    await component['confirm']();

    expect(data.campaignById(campaign.id)?.status).toBe('sending');
    expect(component['notice']()).toContain(campaign.name);

    component['ask'](data.campaignById(campaign.id)!, 'pause');
    await component['confirm']();

    expect(data.campaignById(campaign.id)?.status).toBe('paused');
  });
});
