import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SubscriptionsLogPage } from './subscriptions-log-page';

describe('SubscriptionsLogPage', () => {
  let component: SubscriptionsLogPage;
  let fixture: ComponentFixture<SubscriptionsLogPage>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 100 && component['loading'](); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionsLogPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionsLogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the trail newest first with tenant names resolved', () => {
    const rows = component['rows']();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tenantName.length > 0)).toBe(true);

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1]!.createdAt.localeCompare(rows[i]!.createdAt)).toBeGreaterThanOrEqual(0);
    }
  });

  it('labels first-time entries as entered rather than transitioned', () => {
    const first = component['rows']().find((row) => row.from === null);

    expect(first).toBeTruthy();
    expect(component['transition'](first!)).toContain('Entered');
  });
});
