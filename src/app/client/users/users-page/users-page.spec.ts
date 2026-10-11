import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { UsersPage } from './users-page';

describe('UsersPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: UsersPage;
  let fixture: ComponentFixture<UsersPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [UsersPage],
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

    fixture = TestBed.createComponent(UsersPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('hands a manager the acceptance link behind every pending seat', async () => {
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();
    // `load()` resolves through the service's simulated latency.
    await new Promise((resolve) => setTimeout(resolve, 260));

    const data = TestBed.inject(MockDataService);
    const pending = data
      .usersForTenant(data.currentTenant()!.id)
      .filter((user) => user.invited);

    expect(pending.length).toBeGreaterThan(0);
    for (const user of pending) {
      const token = component['inviteToken'](user);
      expect(token).toBeTruthy();
      expect(data.inviteDetails(token)?.user?.id).toBe(user.id);
    }
  });

  it('shows no invite action for an active member', async () => {
    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 260));

    const data = TestBed.inject(MockDataService);
    const active = data
      .usersForTenant(data.currentTenant()!.id)
      .find((user) => !user.invited)!;

    expect(component['inviteToken'](active)).toBeNull();
  });
});
