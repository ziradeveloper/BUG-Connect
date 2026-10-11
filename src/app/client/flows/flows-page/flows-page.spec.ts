import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { FlowsPage } from './flows-page';

describe('FlowsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: FlowsPage;
  let fixture: ComponentFixture<FlowsPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [FlowsPage],
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

    fixture = TestBed.createComponent(FlowsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists every saved flow with its graph size', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['rows']().length).toBe(data.flows().length);
    for (const flow of component['rows']()) {
      expect(component['nodeCount'](flow)).toBeGreaterThan(0);
    }
  });

  it('summarises the workspace automation', () => {
    const data = TestBed.inject(MockDataService);
    const summary = component['summary']();

    expect(summary.total).toBe(data.flows().length);
    expect(summary.live).toBe(data.flows().filter((flow) => flow.isActive).length);
    expect(summary.versions).toBe(data.flowVersions().length);
  });

  it('only offers the live toggle to a manager', async () => {
    expect(component['canManage']()).toBe(false);

    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();
    expect(component['canManage']()).toBe(true);
  });

  it('flips a flow live and back through the confirmation', async () => {
    const data = TestBed.inject(MockDataService);
    const flow = component['rows']().find((row) => row.isActive)!;
    const start = flow.isActive;

    component['pendingToggle'].set(flow);
    await component['confirmToggle']();

    expect(data.flowById(flow.id)!.isActive).toBe(!start);
    expect(component['pendingToggle']()).toBeNull();
    expect(component['notice']()).toContain(flow.name);
  });
});
