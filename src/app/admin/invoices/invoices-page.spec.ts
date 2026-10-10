import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InvoicesPage } from './invoices-page';

describe('InvoicesPage', () => {
  let component: InvoicesPage;
  let fixture: ComponentFixture<InvoicesPage>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 100 && component['loading'](); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicesPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads invoices newest first with tenant names resolved', () => {
    const rows = component['allRows']();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tenantName.length > 0)).toBe(true);

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1]!.issuedAt.localeCompare(rows[i]!.issuedAt)).toBeGreaterThanOrEqual(0);
    }
  });

  it('filters rows by the selected status', () => {
    component['selectStatus']('paid');

    const filtered = component['rows']();
    expect(filtered.every((row) => row.status === 'paid')).toBe(true);

    component['selectStatus'](null);
    expect(component['rows']().length).toBe(component['allRows']().length);
  });

  it('adds outstanding and overdue from the same rows', () => {
    const summary = component['summary']();
    const rows = component['allRows']();

    const expectedOutstanding = rows
      .filter((row) => row.status === 'due' || row.status === 'overdue')
      .reduce((sum, row) => sum + row.amountInr, 0);

    expect(summary.outstanding).toBe(expectedOutstanding);
    expect(summary.overdue).toBeLessThanOrEqual(summary.outstanding);
  });
});
