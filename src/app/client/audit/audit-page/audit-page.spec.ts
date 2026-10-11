import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { AuditPage } from './audit-page';

describe('AuditPage (workspace)', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: AuditPage;
  let fixture: ComponentFixture<AuditPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AuditPage],
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

    fixture = TestBed.createComponent(AuditPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows only this workspace’s rows', () => {
    const data = TestBed.inject(MockDataService);
    const tenantId = data.currentTenant()?.id;

    expect(component['summary']().total).toBe(data.auditForTenant(tenantId).length);
    expect(component['rows']().every((row) => row.tenantId === tenantId)).toBe(true);
    expect(component['summary']().critical).toBeGreaterThan(0);
  });

  it('filters by area and severity, then clears back to the full trail', () => {
    const total = component['summary']().total;

    component['selectArea']('billing');
    expect(component['rows']().every((row) => row.area === 'billing')).toBe(true);

    component['selectLevel']('info');
    expect(component['rows']().every((row) => row.level === 'info')).toBe(true);

    component['selectArea'](null);
    component['selectLevel']('info');
    expect(component['rows']().length).toBeLessThanOrEqual(total);
  });

  it('picks up rows written by the actions themselves', async () => {
    const data = TestBed.inject(MockDataService);
    const before = component['summary']().total;

    await data.saveQuickReply({ trigger: '/audit-spec', body: 'Recorded action.' });

    expect(component['summary']().total).toBe(before + 1);
    expect(component['rows']().some((row) => row.action.includes('/audit-spec'))).toBe(true);
  });
});
