import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { FlowSimulatorPage } from './flow-simulator-page';

describe('FlowSimulatorPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: FlowSimulatorPage;
  let fixture: ComponentFixture<FlowSimulatorPage>;
  let flowId: string;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [FlowSimulatorPage],
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

    flowId = TestBed.inject(MockDataService).flows()[0]!.id;

    fixture = TestBed.createComponent(FlowSimulatorPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', flowId);
    fixture.detectChanges();
  });

  it('opens on the trigger message without needing a client-side seed', () => {
    expect(component['flow']()).not.toBeNull();
    expect(component['transcript']().length).toBe(1);
    expect(component['transcript']()[0]!.role).toBe('bot');
    expect(component['current']()?.kind).toBe('inbound');
    expect(component['status']().label).toBe('In flow');
  });

  it('runs the automatic continuation into the menu', () => {
    component['advance']();

    expect(component['current']()?.kind).toBe('menu');
    expect(component['transcript']().length).toBe(2);
  });

  it('walks a menu choice and ends at the close node', () => {
    component['advance']();

    const menu = component['current']()!;
    const ending = menu.options.find((option) => option.label === 'See our hours')!;
    component['choose'](ending.id);

    // Trigger, menu, the choice, the close message and the handoff note.
    expect(component['current']()?.kind).toBe('close');
    expect(component['status']().label).toBe('Handed to an agent');
    expect(component['transcript']().length).toBe(5);
  });

  it('resets the run and replays it as the customer', () => {
    component['advance']();
    component['choose'](component['current']()!.options[0]!.id);
    expect(component['transcript']().length).toBeGreaterThan(2);

    component['restart']();
    expect(component['transcript']().length).toBe(1);

    component['restartWithKeyword']();
    expect(component['transcript']().length).toBe(3);
  });

  it('never writes to the workspace', () => {
    const data = TestBed.inject(MockDataService);
    const before = data.auditForTenant(data.currentTenant()!.id).length;
    const version = data.flowById(flowId)!.version;

    component['advance']();
    component['choose'](component['current']()!.options[0]!.id);

    expect(data.flowById(flowId)!.version).toBe(version);
    expect(data.auditForTenant(data.currentTenant()!.id).length).toBe(before);
  });
});
