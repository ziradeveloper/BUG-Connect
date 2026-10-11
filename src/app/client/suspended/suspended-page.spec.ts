import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { SuspendedPage } from './suspended-page';

describe('SuspendedPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: SuspendedPage;
  let fixture: ComponentFixture<SuspendedPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SuspendedPage],
      providers: [
        // The page never renders a router link; a stub keeps the dev-reactivate
        // navigation from needing a route to land on.
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
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

    fixture = TestBed.createComponent(SuspendedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('explains why the workspace is locked once it is suspended', async () => {
    const data = TestBed.inject(MockDataService);
    const tenant = data.currentTenant()!;

    await data.setTenantStatus(tenant.id, 'suspended');
    fixture.detectChanges();

    expect(component['reason']()).toContain('Suspended by the platform team');
    expect(component['tenant']()?.businessName).toBe(tenant.businessName);
    expect(component['support']().email).toBe(data.platformSettings().supportEmail);
  });

  it('signs the visitor out instead of trapping them', () => {
    const session = TestBed.inject(SessionService);
    session.loginAs('admin');
    expect(session.user()).not.toBeNull();

    component['signOut']();

    expect(session.user()).toBeNull();
  });

  it('reactivates through the dev shortcut', async () => {
    const data = TestBed.inject(MockDataService);
    const tenant = data.currentTenant()!;
    await data.setTenantStatus(tenant.id, 'suspended');

    await component['reactivate']();

    expect(data.tenantById(tenant.id)?.status).toBe('active');
    expect(component['notice']()).toContain('active again');
  });
});
