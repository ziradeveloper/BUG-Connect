import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { FlowVersionsPage } from './flow-versions-page';

describe('FlowVersionsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: FlowVersionsPage;
  let fixture: ComponentFixture<FlowVersionsPage>;
  let flowId: string;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [FlowVersionsPage],
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

    TestBed.inject(SessionService).loginAs('admin');
    flowId = TestBed.inject(MockDataService).flows()[0]!.id;

    fixture = TestBed.createComponent(FlowVersionsPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', flowId);
    fixture.detectChanges();
  });

  it('lists the publish history newest first with the current one flagged', () => {
    const data = TestBed.inject(MockDataService);
    const rows = component['rows']();

    expect(rows.length).toBe(data.flowById(flowId)!.version);
    expect(rows[0]!.version).toBe(data.flowById(flowId)!.version);
    expect(component['isCurrent'](rows[0]!)).toBe(true);
    expect(component['summary']().total).toBe(rows.length);
  });

  it('rolls back through the confirmation and announces the new version', async () => {
    const data = TestBed.inject(MockDataService);
    const target = component['rows']().find((version) => !component['isCurrent'](version))!;
    const before = data.flowById(flowId)!.version;

    component['pendingRestore'].set(target);
    await component['confirmRestore']();

    expect(component['pendingRestore']()).toBeNull();
    expect(data.flowById(flowId)!.version).toBe(before + 1);
    expect(component['notice']()).toContain(`Restored v${target.version}`);
    expect(component['rows']()[0]!.version).toBe(before + 1);
  });

  it('hides the restore action for the current version', () => {
    // `isCurrent` is what the template gates the button on.
    const current = component['rows']()[0]!;
    expect(component['isCurrent'](current)).toBe(true);
    expect(component['isCurrent'](component['rows']()[1] ?? current)).toBe(component['rows']().length === 1);
  });
});
