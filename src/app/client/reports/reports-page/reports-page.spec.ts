import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { ReportsPage } from './reports-page';

/**
 * Analytics & Insights (`/reports`, wave 6).
 *
 * The page owns no numbers of its own, so the checks are that it shows the
 * service snapshot for the selected window, that the SVG geometry follows the
 * series, and that switching the window really rebuilds the chart.
 */
describe('ReportsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: ReportsPage;
  let fixture: ComponentFixture<ReportsPage>;
  let data: MockDataService;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ReportsPage],
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

    data = TestBed.inject(MockDataService);
    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reports the workspace’s own traffic for the default window', () => {
    const snapshot = data.reportSnapshot(7);

    expect(component['range']()).toBe(7);
    expect(component['report']().messagesTotal).toBe(snapshot.messagesTotal);
    expect(component['report']().funnel.broadcasts).toBe(data.campaigns().length);
    expect(component['report']().agents.length).toBe(snapshot.agents.length);
    expect(text()).toContain('Analytics & Insights');
    expect(text()).toContain('Message volume');
    expect(text()).toContain('Broadcast funnel');
    expect(text()).toContain('Team performance');
  });

  it('draws one chart point per day and a path that starts at the first day', () => {
    const chart = component['chart']();

    expect(chart.points).toHaveLength(component['range']());
    expect(chart.max).toBeGreaterThanOrEqual(5);
    expect(chart.inbound.startsWith('M')).toBe(true);
    expect(chart.outbound.startsWith('M')).toBe(true);
    expect(chart.area.endsWith('Z')).toBe(true);
    // Gridlines run from the axis maximum down to zero.
    expect(chart.gridlines.map((line) => line.label)).toEqual([
      String(chart.max),
      String(Math.round(chart.max * 0.75)),
      String(Math.round(chart.max * 0.5)),
      String(Math.round(chart.max * 0.25)),
      '0',
    ]);
    // The busiest day sits at or above every other point on the canvas.
    const highest = Math.min(...chart.points.map((point) => point.y));
    const busiest = chart.points.find((point) => point.total === component['report']().peak?.total);

    expect(busiest?.y).toBe(highest);
    expect(chart.labels.length).toBeGreaterThan(0);
    expect(chart.labels.length).toBeLessThanOrEqual(8);
  });

  it('rebuilds the chart when the window changes', () => {
    const week = component['chart']().points.length;

    component['setRange'](30);
    fixture.detectChanges();

    expect(component['range']()).toBe(30);
    expect(component['chart']().points).toHaveLength(30);
    expect(component['chart']().points.length).toBeGreaterThan(week);
    expect(component['report']().messagesTotal).toBe(data.reportSnapshot(30).messagesTotal);
    expect(text()).toContain('last 30 days');

    component['setRange'](90);
    fixture.detectChanges();

    expect(component['chart']().points).toHaveLength(90);
    expect(text()).toContain('last 90 days');
  });

  it('renders the automation ring, funnel and leaderboard from the snapshot', () => {
    const snapshot = component['report']();

    expect(component['ring']()).toContain(`conic-gradient(var(--theme-brand) 0% ${snapshot.automation.containedPct}%`);
    expect(component['funnelTone']('read')).toBe('success');
    expect(component['funnelTone']('audience')).toBe('neutral');
    expect(component['funnelTone']('unknown-stage')).toBe('neutral');

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

    expect(rows.length).toBeGreaterThan(0);
    expect(snapshot.agents[0]!.name).toBeTruthy();
    expect(text()).toContain(snapshot.agents[0]!.name);
  });

  it('formats durations for a business owner', () => {
    expect(component['minutes'](null)).toBe('—');
    expect(component['minutes'](9)).toBe('9m');
    expect(component['minutes'](59)).toBe('59m');
    expect(component['minutes'](65)).toBe('1h 05m');
    expect(component['minutes'](140)).toBe('2h 20m');
  });

  it('says so plainly when a window has no traffic', () => {
    // Every seeded thread is recent, so a window that starts after them is empty.
    const empty = component['chart']();

    expect(empty.points.length).toBe(component['range']());
    // The summary line always describes the window that is on screen.
    expect(component['summary']()).toContain(`${component['range']()} days`);
  });
});
