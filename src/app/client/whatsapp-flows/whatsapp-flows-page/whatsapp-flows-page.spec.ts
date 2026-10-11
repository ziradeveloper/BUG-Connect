import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { WhatsAppFlowsPage } from './whatsapp-flows-page';

describe('WhatsAppFlowsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: WhatsAppFlowsPage;
  let fixture: ComponentFixture<WhatsAppFlowsPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [WhatsAppFlowsPage],
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

    fixture = TestBed.createComponent(WhatsAppFlowsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists every form in the workspace, newest edit first', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['rows']().length).toBe(data.whatsappFlows().length);
    const stamps = component['rows']().map((form) => form.updatedAt);
    expect(stamps).toEqual([...stamps].sort((a, b) => b.localeCompare(a)));
  });

  it('summarises the workspace forms', () => {
    const data = TestBed.inject(MockDataService);
    const summary = component['summary']();

    expect(summary.total).toBe(data.whatsappFlows().length);
    expect(summary.published).toBe(
      data.whatsappFlows().filter((form) => form.status === 'published').length,
    );
    expect(summary.screens).toBe(
      data.whatsappFlows().reduce((total, form) => total + form.screens.length, 0),
    );
  });

  it('names the chat flow that sends a published form', () => {
    const data = TestBed.inject(MockDataService);
    const published = component['rows']().find((form) => form.status === 'published');

    expect(published).toBeTruthy();
    expect(component['linkedLabel'](published!)).toContain(
      data.linkedFlowFor(published!.id)?.name as string,
    );
    expect(component['postsLabel'](published!)).toMatch(/\d+ fields?/);
  });

  it('only offers publish to a manager, and blocks a form that would fail', async () => {
    const data = TestBed.inject(MockDataService);
    expect(component['canManage']()).toBe(false);

    TestBed.inject(SessionService).loginAs('admin');
    fixture.detectChanges();
    expect(component['canManage']()).toBe(true);

    // The seeded forms are valid, so nothing reports a blocker.
    for (const form of component['rows']()) {
      expect(component['blocker'](data.waFlowById(form.id)!)).toBeNull();
    }
  });

  it('withdraws a published form back to draft through the confirmation', async () => {
    const data = TestBed.inject(MockDataService);
    const published = component['rows']().find((form) => form.status === 'published')!;

    component['ask'](published, 'withdraw');
    expect(component['dialogTitle']()).toContain(published.name);
    expect(component['dialogConfirm']()).toBe('Move to draft');

    await component['confirm']();

    expect(data.waFlowById(published.id)?.status).toBe('draft');
    expect(component['pending']()).toBeNull();
    expect(component['notice']()).toContain(published.name);
  });

  it('surfaces the publish error instead of changing the form', async () => {
    const data = TestBed.inject(MockDataService);
    const saved = await data.saveWhatsAppFlow({
      name: 'Half-built form',
      screens: [
        {
          id: 'EMPTY',
          title: 'Empty',
          subtitle: null,
          terminal: true,
          nextScreenId: null,
          footerLabel: 'Send',
          fields: [],
        },
      ],
    });

    component['ask'](data.waFlowById(saved.id)!, 'publish');
    await component['confirm']();

    expect(data.waFlowById(saved.id)?.status).toBe('draft');
    expect(component['error']()).toBeTruthy();
    expect(component['notice']()).toBeNull();
  });
});
