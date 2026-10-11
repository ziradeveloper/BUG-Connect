import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { PlatformAnalyticsPage } from './analytics-page';

/**
 * Cross-tenant analytics (`/analytics`).
 *
 * The page owns no figures, so the checks are that it shows the service snapshot
 * for the selected window, that the SVG follows the series, and that the
 * workspaces' states read out in words a platform owner recognises.
 */
describe('PlatformAnalyticsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  let component: PlatformAnalyticsPage;
  let fixture: ComponentFixture<PlatformAnalyticsPage>;
  let data: MockDataService;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [PlatformAnalyticsPage],
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
            displayName: computed(() => 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    data = TestBed.inject(MockDataService);
    fixture = TestBed.createComponent(PlatformAnalyticsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the whole estate for the default window', () => {
    const snapshot = data.platformSnapshot(30);

    expect(component['range']()).toBe(30);
    expect(component['snapshot']().tenants.total).toBe(snapshot.tenants.total);
    expect(component['snapshot']().messagesTotal).toBe(snapshot.messagesTotal);
    expect(component['snapshot']().topWorkspaces).toHaveLength(snapshot.topWorkspaces.length);
    expect(text()).toContain('Cross-tenant analytics');
    expect(text()).toContain('Adoption by plan');
    expect(text()).toContain('Onboarding funnel');
    expect(text()).toContain('Workspace usage');
    // The seeded estate's own workspace names are on screen.
    expect(text()).toContain(data.tenants()[0]!.businessName);
  });

  it('draws one chart point per day', () => {
    const chart = component['chart']();

    expect(chart.points).toHaveLength(component['range']());
    expect(chart.max).toBeGreaterThanOrEqual(5);
    expect(chart.inbound.startsWith('M')).toBe(true);
    expect(chart.outbound.startsWith('M')).toBe(true);
    expect(chart.area.endsWith('Z')).toBe(true);
    expect(chart.gridlines.map((line) => line.label)).toEqual([
      String(chart.max),
      String(Math.round(chart.max * 0.75)),
      String(Math.round(chart.max * 0.5)),
      String(Math.round(chart.max * 0.25)),
      '0',
    ]);
    expect(chart.labels.length).toBeGreaterThan(0);
    expect(chart.labels.length).toBeLessThanOrEqual(8);
  });

  it('rebuilds the chart when the window changes', () => {
    component['setRange'](7);
    fixture.detectChanges();

    expect(component['chart']().points).toHaveLength(7);
    expect(component['snapshot']().messagesTotal).toBe(data.platformSnapshot(7).messagesTotal);
    expect(text()).toContain('last 7 days');

    component['setRange'](90);
    fixture.detectChanges();

    expect(component['chart']().points).toHaveLength(90);
    expect(text()).toContain('last 90 days');
  });

  it('renders the plan, funnel and industry panels from the snapshot', () => {
    const snapshot = component['snapshot']();

    expect(component['snapshot']().tiers.length).toBe(snapshot.tiers.length);
    expect(component['tierClass']({ tier: 'Growth' } as never)).toBe(
      'ana-tier__fill ana-tier__fill--growth',
    );
    expect(component['stageClass']({ key: 'firstBroadcast' } as never)).toBe(
      'ana-funnel__fill ana-funnel__fill--firstBroadcast',
    );
    expect(component['snapshot']().activation).toHaveLength(5);
    expect(component['snapshot']().industries.length).toBeGreaterThan(0);
    // The funnel note names the weakest step rather than restating a number.
    expect(component['funnelNote']()).toMatch(/drop-off|every step/);
  });

  it('reads money, days and workspace states in words', () => {
    expect(component['inr'](14900)).toBe('₹14,900');
    expect(component['days'](null)).toBe('—');
    expect(component['days'](0)).toBe('Same day');
    expect(component['days'](1)).toBe('1 day');
    expect(component['days'](12)).toBe('12 days');

    expect(component['statusLabel']('active')).toBe('Active');
    expect(component['statusLabel']('onboarding')).toBe('Onboarding');
    expect(component['statusLabel']('whatsapp_pending')).toBe('WhatsApp pending');
    expect(component['statusLabel']('suspended')).toBe('Suspended');
    expect(component['statusLabel']('archived')).toBe('Archived');
    expect(component['statusLabel']('lead_trial')).toBe('Trial lead');

    expect(component['statusTone']('active')).toBe('success');
    expect(component['statusTone']('whatsapp_pending')).toBe('warning');
    expect(component['statusTone']('suspended')).toBe('danger');
    expect(component['statusTone']('archived')).toBe('neutral');

    // Every seeded workspace resolves to a label the table can print.
    for (const tenant of data.tenants()) {
      expect(component['statusLabel'](tenant.status).length).toBeGreaterThan(0);
    }
  });

  it('never projects revenue', () => {
    // The billing card is invoices as issued: the seed carries no price list.
    const snapshot = component['snapshot']();

    expect(snapshot.billing.collectedInr).toBeGreaterThan(0);
    expect(text()).toContain('₹');
    expect(text()).not.toContain('MRR');
    expect(text()).not.toContain('projected');
  });
});
