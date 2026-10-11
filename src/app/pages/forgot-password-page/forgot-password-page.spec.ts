import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { NgForm } from '@angular/forms';

import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { ForgotPasswordPage } from './forgot-password-page';

const SUBMITTABLE = { invalid: false } as unknown as NgForm;

describe('ForgotPasswordPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'marketing',
    slug: null,
    host: 'localhost:4200',
    source: 'default',
  });

  let component: ForgotPasswordPage;
  let fixture: ComponentFixture<ForgotPasswordPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
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

    fixture = TestBed.createComponent(ForgotPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('offers the seeded accounts so the flow is walkable', () => {
    const data = TestBed.inject(MockDataService);
    const accounts = component['demoAccounts']();

    expect(accounts.some((account) => account.email === data.platformStaff()[0]?.email)).toBe(true);
    expect(accounts.length).toBeGreaterThanOrEqual(data.tenants().length);
  });

  it('surfaces the simulated link for an address that exists', async () => {
    const data = TestBed.inject(MockDataService);
    const admin = data.usersForTenant(data.tenants()[0]!.id).find((user) => user.role === 'admin');

    component['email'] = admin!.email;
    await component['onSubmit'](SUBMITTABLE);

    expect(component['status']()).toBe('sent');
    expect(component['result']()?.name).toBe(admin!.fullName);
    expect(data.resetRequestFor(component['result']()!.token)).not.toBeNull();
  });

  it('answers unknown addresses without minting a token', async () => {
    component['email'] = 'stranger@example.com';
    await component['onSubmit'](SUBMITTABLE);

    expect(component['status']()).toBe('unknown');
    expect(component['result']()).toBeNull();
  });
});
