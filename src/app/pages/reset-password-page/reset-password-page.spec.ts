import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { NgForm } from '@angular/forms';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { ResetPasswordPage } from './reset-password-page';

const SUBMITTABLE = { invalid: false } as unknown as NgForm;

describe('ResetPasswordPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'marketing',
    slug: null,
    host: 'localhost:4200',
    source: 'default',
  });

  let component: ResetPasswordPage;
  let fixture: ComponentFixture<ResetPasswordPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
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

    fixture = TestBed.createComponent(ResetPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('rejects an unknown token before showing a form', () => {
    fixture.componentRef.setInput('token', 'reset-nope');
    fixture.detectChanges();

    expect(component['request']()).toBeNull();
  });

  it('enforces the password rules', async () => {
    const data = TestBed.inject(MockDataService);
    const admin = data.users().find((user) => user.role === 'admin')!;
    const issued = await data.requestPasswordReset(admin.email);
    fixture.componentRef.setInput('token', issued.token);
    fixture.detectChanges();

    component['password'] = 'short';
    component['confirmation'] = 'short';
    await component['onSubmit'](SUBMITTABLE);
    expect(component['error']()).toContain('8 characters');

    component['password'] = 'onlyletters';
    component['confirmation'] = 'onlyletters';
    await component['onSubmit'](SUBMITTABLE);
    expect(component['error']()).toContain('letter and a number');

    component['password'] = 'Wave5pass1';
    component['confirmation'] = 'Wave5pass9';
    await component['onSubmit'](SUBMITTABLE);
    expect(component['error']()).toContain('do not match');
  });

  it('spends the token and registers the chosen password with the session', async () => {
    const data = TestBed.inject(MockDataService);
    const session = TestBed.inject(SessionService);
    const admin = data.users().find((user) => user.role === 'admin')!;
    const issued = await data.requestPasswordReset(admin.email);

    fixture.componentRef.setInput('token', issued.token);
    fixture.detectChanges();

    component['password'] = 'Wave5pass1';
    component['confirmation'] = 'Wave5pass1';
    await component['onSubmit'](SUBMITTABLE);

    expect(component['status']()).toBe('done');
    expect(data.resetRequestFor(issued.token)).toBeNull();

    // The new password works, and the shared demo password still does too.
    expect(session.login(admin.email, 'Wave5pass1').ok).toBe(true);
    expect(session.login(admin.email, session.demoPassword).ok).toBe(true);
  });
});
