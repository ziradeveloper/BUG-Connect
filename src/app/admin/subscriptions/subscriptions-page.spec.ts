import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { SubscriptionsPage } from './subscriptions-page';

describe('SubscriptionsPage', () => {
  let component: SubscriptionsPage;
  let fixture: ComponentFixture<SubscriptionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionsPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('derives one current state per tenant from the event trail', () => {
    const data = TestBed.inject(MockDataService);
    const rows = component['rows']();

    expect(rows.length).toBe(data.tenants().length);

    for (const row of rows) {
      const trail = data.subscriptionEventsForTenant(row.id);
      const latest = [...trail].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      expect(row.state).toBe(row.status === 'suspended' ? 'suspended' : (latest?.to ?? 'trial'));
    }
  });

  it('summarises states that add up to the tenant count', () => {
    const summary = component['summary']();

    expect(summary.active + summary.trial + summary.attention).toBe(summary.total);
    expect(summary.total).toBe(component['rows']().length);
  });
});
