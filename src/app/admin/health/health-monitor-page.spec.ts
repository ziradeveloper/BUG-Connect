import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { HealthMonitorPage } from './health-monitor-page';

describe('HealthMonitorPage', () => {
  let component: HealthMonitorPage;
  let fixture: ComponentFixture<HealthMonitorPage>;

  async function settle(): Promise<void> {
    for (let i = 0; i < 100 && component['loading'](); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [HealthMonitorPage],
      providers: [provideRouter([])],
    }).compileComponents();

    TestBed.inject(SessionService).loginAs('systemadmin');

    fixture = TestBed.createComponent(HealthMonitorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('summarises latency and outcomes from the same rows', () => {
    const stats = component['stats']();
    const rows = component['rows']();

    expect(stats.total).toBe(rows.length);
    expect(stats.failed).toBe(rows.filter((row) => row.outcome === 'failed').length);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50);
    expect(component['buckets']().reduce((sum, bucket) => sum + bucket.count, 0)).toBe(rows.length);
  });

  it('acknowledges a failed event back into the retry queue', async () => {
    const failed = component['rows']().find((row) => row.outcome === 'failed');

    if (!failed) {
      expect(component['canAck']()).toBe(true);
      return;
    }

    await component['acknowledge'](failed);

    const updated = component['rows']().find((row) => row.id === failed.id);
    expect(updated?.outcome).toBe('queued');
    expect(updated?.error).toBeNull();
  });
});
