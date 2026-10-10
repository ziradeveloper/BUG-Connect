import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { TeamsPage } from './teams-page';

describe('TeamsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: TeamsPage;
  let fixture: ComponentFixture<TeamsPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [TeamsPage],
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
            displayName: computed(() => resolution().slug ?? 'Workspace'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(SessionService).loginAs('admin');
    data = TestBed.inject(MockDataService);
    fixture = TestBed.createComponent(TeamsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('seeds three routing teams with members and a default', async () => {
    await data.listTeams();
    fixture.detectChanges();

    const teams = data.teams();
    expect(teams.length).toBe(3);
    expect(teams.filter((team) => team.isDefault)).toHaveLength(1);
    expect(teams.every((team) => team.memberUserIds.length > 0)).toBe(true);
    expect(text()).toContain('Support Desk');
  });

  it('requires a name and at least one member', async () => {
    component['newTeam']();
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('needs a name');

    component['update']({ name: 'Empty team' });
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('at least one member');
    expect(data.teams().some((team) => team.name === 'Empty team')).toBe(false);
  });

  it('creates a team and shares the round-robin across weights', async () => {
    component['newTeam']();
    const member = data.users()[0]!.id;
    component['update']({ name: 'Spec team', weight: 6, memberUserIds: [member] });
    await component['save']();
    fixture.detectChanges();

    const saved = data.teams().find((team) => team.name === 'Spec team')!;
    expect(saved).toBeTruthy();
    expect(saved.isDefault).toBe(false);

    const shares = data.teams().map((team) => component['shareOf'](team));
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeGreaterThanOrEqual(99);
  });

  it('keeps exactly one default when deleting the default team', async () => {
    const current = data.teams().find((team) => team.isDefault)!;
    component['pendingDelete'].set(current);
    await component['confirmDelete']();

    const remaining = data.teams();
    expect(remaining.some((team) => team.id === current.id)).toBe(false);
    expect(remaining.filter((team) => team.isDefault)).toHaveLength(1);
  });
});
