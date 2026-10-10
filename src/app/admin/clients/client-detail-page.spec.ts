import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { ClientDetailPage } from './client-detail-page';

/**
 * The detail view stitches one tenant from five reads: the row itself, its
 * staff, its invoices, its subscription trail and its webhook window.
 */
describe('ClientDetailPage', () => {
  let component: ClientDetailPage;
  let fixture: ComponentFixture<ClientDetailPage>;
  let data: MockDataService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDetailPage],
      providers: [provideRouter([])],
    }).compileComponents();

    data = TestBed.inject(MockDataService);
    fixture = TestBed.createComponent(ClientDetailPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('clientId', 'tenant-1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the tenant and its staff', () => {
    expect(component['tenant']()?.id).toBe('tenant-1');
    expect(component['members']().length).toBeGreaterThan(0);
    expect(component['members']().every((member) => member.tenantId === 'tenant-1')).toBe(true);
  });

  it('falls back to the overview tab for unknown tab values', () => {
    fixture.componentRef.setInput('tab', 'whatsapp');
    expect(component['activeTab']()).toBe('whatsapp');

    fixture.componentRef.setInput('tab', 'nope');
    expect(component['activeTab']()).toBe('overview');
  });

  it('builds usage rows against the tier limits', () => {
    const usage = component['usage']();

    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((row) => row.used >= 0)).toBe(true);
    expect(component['usagePercent']({ label: 'x', used: 5, limit: 10 })).toBe(50);
    expect(component['usageTone']({ label: 'x', used: 11, limit: 10 })).toBe('over');
  });

  it('orders the timeline newest first with a provisioning milestone', () => {
    const timeline = component['timeline']();

    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.some((item) => item.title === 'Workspace provisioned')).toBe(true);

    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i - 1]!.at.localeCompare(timeline[i]!.at)).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves the tier on confirm', async () => {
    component['askTierChange']('Scale');
    expect(component['pendingTier']()).toBe('Scale');

    await component['confirmTierChange']();

    expect(data.tenantById('tenant-1')?.subscriptionTier).toBe('Scale');
  });

  it('shows the not-found state for an unknown client', () => {
    fixture.componentRef.setInput('clientId', 'tenant-missing');
    fixture.detectChanges();

    expect(component['tenant']()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Client not found');
  });
});
