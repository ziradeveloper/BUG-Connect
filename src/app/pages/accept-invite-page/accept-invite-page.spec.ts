import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { NgForm } from '@angular/forms';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { AcceptInvitePage } from './accept-invite-page';

const SUBMITTABLE = { invalid: false } as unknown as NgForm;

describe('AcceptInvitePage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'marketing',
    slug: null,
    host: 'localhost:4200',
    source: 'default',
  });

  let component: AcceptInvitePage;
  let fixture: ComponentFixture<AcceptInvitePage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AcceptInvitePage],
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
            displayName: computed(() => 'BUGConnect'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptInvitePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the invalid state for a link that carries no seat', () => {
    fixture.componentRef.setInput('token', 'invite-nope');
    fixture.detectChanges();

    expect(component['details']()).toBeNull();
  });

  it('activates the seat and registers the chosen password', async () => {
    const data = TestBed.inject(MockDataService);
    const session = TestBed.inject(SessionService);
    const invited = data.users().find((user) => user.invited)!;
    const invite = data.ensureInvite(invited.id)!;

    fixture.componentRef.setInput('token', invite.token);
    fixture.detectChanges();

    expect(component['details']()?.tenant?.businessName).toBeTruthy();

    component['password'] = 'Wave5pass1';
    component['confirmation'] = 'Wave5pass1';
    await component['onSubmit'](SUBMITTABLE);

    expect(component['status']()).toBe('done');
    expect(data.users().find((user) => user.id === invited.id)?.invited).toBe(false);
    expect(session.login(invited.email, 'Wave5pass1').ok).toBe(true);
  });

  it('refuses a spent invitation', async () => {
    const data = TestBed.inject(MockDataService);
    const invited = data.users().find((user) => user.invited)!;
    const invite = data.ensureInvite(invited.id)!;
    await data.acceptInvite(invite.token);

    fixture.componentRef.setInput('token', invite.token);
    fixture.detectChanges();

    component['password'] = 'Wave5pass1';
    component['confirmation'] = 'Wave5pass1';
    await component['onSubmit'](SUBMITTABLE);

    expect(component['status']()).toBe('idle');
    expect(component['error']()).toContain('already been accepted');
    expect(component['details']()?.accepted).toBe(true);
  });
});
