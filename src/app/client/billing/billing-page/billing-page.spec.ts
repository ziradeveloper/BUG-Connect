import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { BillingPage } from './billing-page';

describe('BillingPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: BillingPage;
  let fixture: ComponentFixture<BillingPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [BillingPage],
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

    fixture = TestBed.createComponent(BillingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('reads the plan the workspace is actually on', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['plan']()?.tier).toBe(data.currentTenant()?.subscriptionTier);
    expect(component['seatLimit']()).toBe(component['plan']()?.limits.seats ?? null);
  });

  it('measures usage against every metered dimension', () => {
    const data = TestBed.inject(MockDataService);
    const rows = component['usageRows']();

    expect(component['usage']().seats).toBe(data.users().length);
    expect(rows.map((row) => row.key)).toEqual([
      'seats',
      'contacts',
      'messagesPerMonth',
      'campaignsPerMonth',
      'flows',
      'whatsappNumbers',
    ]);
    expect(rows.every((row) => row.limitLabel.length > 0)).toBe(true);
  });

  it('moves the workspace through the simulated checkout', async () => {
    const data = TestBed.inject(MockDataService);
    // Plan changes need billing rights, so sign in as the workspace admin.
    TestBed.inject(SessionService).loginAs('admin');

    const tenant = data.currentTenant()!;
    const target = tenant.subscriptionTier === 'Scale' ? 'Growth' : 'Scale';

    expect(component['canManage']()).toBe(true);
    component['openCheckout'](target);
    expect(component['checkoutTier']()).toBe(target);

    await component['confirmCheckout']();

    expect(data.tenantById(tenant.id)?.subscriptionTier).toBe(target);
    expect(component['checkoutTier']()).toBeNull();
    expect(component['notice']()).toContain(target);
  });

  it('keeps custom pricing honest while the PRD lists no prices', () => {
    expect(component['priceLabel'](component['plan']()!)).toBe('Custom pricing');
    expect(component['nextInvoiceLabel']()).toBeTruthy();
  });

  it('lists the workspace invoices newest first', () => {
    const rows = component['invoices']();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.issuedAt >= rows[rows.length - 1]!.issuedAt).toBe(true);
    expect(rows.every((row) => row.tenantId === TestBed.inject(MockDataService).currentTenant()?.id)).toBe(
      true,
    );
  });
});
