import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { announcementState } from '../../../core/data/announcements';
import { DATA_NOW } from '../../../shared/format';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { AnnouncementsPage } from './announcements-page';

/**
 * Platform announcements list (`/announcements`, wave 6).
 *
 * The list shows every notice with the state its own schedule implies, so the
 * checks here are that the state, the reach and the available actions all follow
 * from the rows rather than from anything the page remembers.
 */
describe('AnnouncementsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  let component: AnnouncementsPage;
  let fixture: ComponentFixture<AnnouncementsPage>;
  let data: MockDataService;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [AnnouncementsPage],
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
    TestBed.inject(SessionService).loginAs('systemadmin');
    fixture = TestBed.createComponent(AnnouncementsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists every notice with the reach measured against the tenant list', () => {
    expect(component['rows']()).toHaveLength(data.announcements().length);
    expect(component['summary']().total).toBe(data.announcements().length);
    expect(text()).toContain('Announcements');
    expect(text()).toContain('New announcement');

    for (const row of component['rows']()) {
      expect(row.reach.workspaces).toBe(data.announcementReach(row).workspaces);
      expect(announcementState(row, DATA_NOW)).toBe(component['stateOf'](row));
    }

    // The seeded set spans every state.
    const states = component['rows']().map((row) => component['stateOf'](row));

    expect(states).toContain('live');
    expect(states).toContain('scheduled');
    expect(states).toContain('draft');
    expect(component['summary']().live).toBe(states.filter((state) => state === 'live').length);
    expect(component['summary']().scheduled).toBe(
      states.filter((state) => state === 'scheduled').length,
    );
    // Live notices reach real workspaces.
    expect(component['summary']().reached).toBeGreaterThan(0);
  });

  it('labels and colours each state', () => {
    const byId = (id: string) => component['rows']().find((row) => row.id === id)!;

    expect(component['stateLabel'](byId('ann-maintenance'))).toBe('Live');
    expect(component['stateTone'](byId('ann-maintenance'))).toBe('success');
    expect(component['stateLabel'](byId('ann-invoices'))).toBe('Scheduled');
    expect(component['stateTone'](byId('ann-invoices'))).toBe('info');
    expect(component['stateLabel'](byId('ann-residency'))).toBe('Draft');
    expect(component['stateTone'](byId('ann-residency'))).toBe('neutral');
    expect(component['stateLabel'](byId('ann-trial-billing'))).toBe('Expired');
    expect(component['stateTone'](byId('ann-trial-billing'))).toBe('warning');
    expect(component['stateLabel'](byId('ann-withdrawn'))).toBe('Withdrawn');
    expect(component['stateTone'](byId('ann-withdrawn'))).toBe('danger');
    expect(component['kindLabel']('maintenance')).toBe('Maintenance');
  });

  it('pins and unpins a notice', async () => {
    const row = component['rows']().find((candidate) => candidate.id === 'ann-flow-builder')!;

    expect(row.pinned).toBe(false);

    await component['togglePin'](row);
    fixture.detectChanges();

    expect(data.announcementById('ann-flow-builder')?.pinned).toBe(true);
    expect(component['notice']()).toContain('Pinned');

    await component['togglePin'](component['rows']().find((candidate) => candidate.id === 'ann-flow-builder')!);

    expect(data.announcementById('ann-flow-builder')?.pinned).toBe(false);
    expect(component['notice']()).toContain('Unpinned');
  });

  it('withdraws a live notice behind the confirmation', async () => {
    const row = component['rows']().find((candidate) => candidate.id === 'ann-maintenance')!;

    component['askWithdraw'](row);
    expect(component['pendingWithdraw']()).not.toBeNull();

    await component['confirmWithdraw']();
    fixture.detectChanges();

    expect(data.announcementById('ann-maintenance')?.status).toBe('withdrawn');
    expect(component['pendingWithdraw']()).toBeNull();
    expect(component['notice']()).toContain('withdrawn');
    // The row stays in the list as withdrawn.
    expect(component['rows']().some((candidate) => candidate.id === 'ann-maintenance')).toBe(true);
  });

  it('deletes drafts and refuses everything else', async () => {
    await component['confirmDelete']();

    // Nothing was pending, so nothing happened.
    expect(data.announcements()).toHaveLength(6);

    component['askDelete'](data.announcementById('ann-flow-builder')!);
    await component['confirmDelete']();
    fixture.detectChanges();

    expect(data.announcementById('ann-flow-builder')).not.toBeNull();
    expect(component['notice']()).toContain('Only a draft can be deleted');

    component['askDelete'](data.announcementById('ann-residency')!);
    await component['confirmDelete']();
    fixture.detectChanges();

    expect(data.announcementById('ann-residency')).toBeNull();
    expect(component['rows']()).toHaveLength(5);
  });
});
