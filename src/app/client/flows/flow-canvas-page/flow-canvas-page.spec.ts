import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { FlowCanvasPage } from './flow-canvas-page';

describe('FlowCanvasPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: FlowCanvasPage;
  let fixture: ComponentFixture<FlowCanvasPage>;
  let flowId: string;

  const mouse = { shiftKey: false } as unknown as MouseEvent;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [FlowCanvasPage],
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

    fixture = TestBed.createComponent(FlowCanvasPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', flowId);
    fixture.detectChanges();
  });

  it('loads the published graph and refuses unknown ids', () => {
    expect(component['flow']()).not.toBeNull();
    expect(component['nodes']().length).toBe(5);
    expect(component['connections']().length).toBeGreaterThan(0);

    fixture.componentRef.setInput('id', 'nope');
    fixture.detectChanges();
    expect(component['flow']()).toBeNull();
    expect(component['nodes']()).toEqual([]);
  });

  it('stages edits, then publishes them as the next version', async () => {
    const data = TestBed.inject(MockDataService);
    const versionBefore = data.flowById(flowId)!.version;
    const menu = component['nodes']().find((node) => node.kind === 'menu')!;

    component['select'](menu.id);
    component['updateMessage']('How can we help today?');

    expect(component['dirty']()).toBe(true);

    await component['publish']();

    expect(component['dirty']()).toBe(false);
    expect(data.flowById(flowId)!.version).toBe(versionBefore + 1);
    expect(
      data.graphFor(flowId)!.nodes.find((node) => node.id === menu.id)!.message,
    ).toBe('How can we help today?');
    expect(component['notice']()).toContain(`v${versionBefore + 1}`);
  });

  it('moves a node by a grid step, four with shift held', () => {
    const node = component['nodes']()[0]!;
    const x = node.x;
    const y = node.y;

    component['nudge'](node.id, 1, 0, mouse);
    expect(component['nodes']()[0]!.x).toBe(x + 40);

    component['nudge'](node.id, 0, 1, { shiftKey: true } as unknown as MouseEvent);
    expect(component['nodes']()[0]!.y).toBe(y + 160);
  });

  it('adds a node and clears references when one is deleted', () => {
    const before = component['nodes']().length;

    component['addNode']('menu');
    expect(component['nodes']().length).toBe(before + 1);

    const selection = component['nodes']().find((node) => node.kind === 'selection')!;
    component['pendingDelete'].set(selection);
    component['removeNode']();

    expect(component['nodes']().some((node) => node.id === selection.id)).toBe(false);
    for (const node of component['nodes']()) {
      expect(node.options.every((option) => option.nextNodeId !== selection.id)).toBe(true);
      expect(node.nextNodeId).not.toBe(selection.id);
    }
  });

  it('discards the draft back to the published graph', () => {
    const original = component['nodes']()[0]!.message;

    component['select'](component['nodes']()[0]!.id);
    component['updateMessage']('Something else');
    expect(component['dirty']()).toBe(true);

    component['discard']();
    expect(component['dirty']()).toBe(false);
    expect(component['nodes']()[0]!.message).toBe(original);
  });
});
