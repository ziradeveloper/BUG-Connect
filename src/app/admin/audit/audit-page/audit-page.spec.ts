import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { AuditPage } from './audit-page';

describe('AuditPage (platform)', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
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
            displayName: computed(() => 'Platform console'),
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

  it('reads the whole trail, naming the workspace on tenant rows', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['summary']().total).toBe(data.auditLog().length);
    expect(component['rows']().every((row) => row.tenantName.length > 0)).toBe(true);
    expect(component['rows']().some((row) => row.tenantId === null)).toBe(true);
    expect(component['summary']().tenants).toBeGreaterThan(0);
  });

  it('filters to impersonation events only', () => {
    component['toggleImpersonation']();

    const rows = component['rows']();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => component['isImpersonation'](row))).toBe(true);
  });

  it('filters by area and severity', () => {
    component['selectArea']('meta');
    expect(component['rows']().every((row) => row.area === 'meta')).toBe(true);

    component['selectLevel']('critical');
    expect(component['rows']().every((row) => row.level === 'critical')).toBe(true);
  });
});
