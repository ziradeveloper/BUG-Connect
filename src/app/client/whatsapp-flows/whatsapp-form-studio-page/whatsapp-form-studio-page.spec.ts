import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { WhatsAppFormStudioPage } from './whatsapp-form-studio-page';

describe('WhatsAppFormStudioPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: WhatsAppFormStudioPage;
  let fixture: ComponentFixture<WhatsAppFormStudioPage>;

  async function create(id: string): Promise<void> {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [WhatsAppFormStudioPage],
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

    fixture = TestBed.createComponent(WhatsAppFormStudioPage);
    fixture.componentRef.setInput('id', id);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('edits the stored form, screen by screen', async () => {
    await create('tenant-1-waf-1');
    const data = TestBed.inject(MockDataService);
    const stored = data.waFlowById('tenant-1-waf-1')!;

    expect(component['missing']()).toBe(false);
    expect(component['draft']()?.name).toBe(stored.name);
    expect(component['screens']().map((screen) => screen.id)).toEqual(
      stored.screens.map((screen) => screen.id),
    );
    expect(component['dirty']()).toBe(false);
    expect(component['selectedScreen']()?.id).toBe(stored.screens[0]?.id);
  });

  it('starts a new form from one terminal screen', async () => {
    await create('');

    expect(component['missing']()).toBe(false);
    expect(component['draft']()?.name).toBe('');
    expect(component['screens']().length).toBe(1);
    expect(component['screens']()[0]?.terminal).toBe(true);
    // A blank form posts nothing, so it cannot be published yet.
    expect(component['issues']().length).toBeGreaterThan(0);
  });

  it('shows the not-found state for an unknown id', async () => {
    await create('tenant-1-waf-99');

    expect(component['missing']()).toBe(true);
    expect(component['draft']()).toBeNull();
  });

  it('generates the routing model and the screens as flow JSON', async () => {
    await create('tenant-1-waf-1');

    const parsed = JSON.parse(component['json']()) as {
      version: string;
      routing_model: Record<string, string[]>;
      screens: { id: string }[];
    };

    expect(parsed.version).toBeTruthy();
    expect(parsed.screens.map((screen) => screen.id)).toEqual(
      component['screens']().map((screen) => screen.id),
    );
    // The first screen navigates on; the last one is terminal and routes nowhere.
    expect(parsed.routing_model['BOOKING']).toEqual(['CONFIRM']);
    expect(parsed.routing_model['CONFIRM']).toEqual([]);
    expect(component['jsonSize']()).toBeGreaterThan(0);
    expect(component['response']().length).toBeGreaterThan(0);
  });

  it('adds a screen, hands the ending over and repairs the routing on delete', async () => {
    await create('tenant-1-waf-1');

    component['addScreen']();
    expect(component['screens']().length).toBe(3);
    expect(component['screens']().filter((screen) => screen.terminal).length).toBe(1);
    expect(component['screens']().at(-1)?.terminal).toBe(true);
    expect(component['issues']()).toEqual([]);

    // Removing the middle screen leaves the last one ending the form.
    const middle = component['screens']()[1]!;
    component['askRemoveScreen'](middle);
    component['removeScreen']();

    expect(component['screens']().length).toBe(2);
    expect(component['screens']().some((screen) => screen.id === middle.id)).toBe(false);
    expect(component['screens']().filter((screen) => screen.terminal).length).toBe(1);
    expect(component['issues']()).toEqual([]);
  });

  it('adds, edits and removes components on the selected screen', async () => {
    await create('tenant-1-waf-2');
    const before = component['selectedScreen']()!.fields.length;

    component['addField']('Dropdown');
    const added = component['selectedScreen']()!.fields.at(-1)!;
    expect(component['selectedScreen']()!.fields.length).toBe(before + 1);
    expect(component['dirty']()).toBe(true);

    component['setFieldLabel'](added, 'Preferred fabric');
    const renamed = component['selectedScreen']()!.fields.at(-1)!;
    expect(renamed.label).toBe('Preferred fabric');
    expect(renamed.name).toBe('preferred_fabric');

    component['addOption'](renamed);
    expect(component['selectedScreen']()!.fields.at(-1)!.options?.length).toBe(3);

    component['askRemoveField'](renamed);
    component['removeField']();
    expect(component['selectedScreen']()!.fields.length).toBe(before);
  });

  it('saves a new draft through the service', async () => {
    await create('');
    const data = TestBed.inject(MockDataService);

    component['setName']('Store feedback');
    component['addField']('TextInput');
    component['setFieldLabel'](component['selectedScreen']()!.fields[0]!, 'Your feedback');

    const saved = await component['save']();

    expect(saved?.id).toBeTruthy();
    expect(saved?.status).toBe('draft');
    expect(data.waFlowById(saved!.id)?.name).toBe('Store feedback');
    expect(component['draft']()?.id).toBe(saved!.id);
    expect(
      data
        .auditForTenant(data.tenantId())
        .some((event) => event.action.includes('Store feedback')),
    ).toBe(true);
  });

  it('refuses to publish a document Meta would reject', async () => {
    await create('');
    const data = TestBed.inject(MockDataService);

    component['setName']('Nothing to post');
    const saved = await component['save']();

    await component['saveAndPublish']();

    expect(data.waFlowById(saved!.id)?.status).toBe('draft');
    expect(component['error']()).toBeTruthy();
  });

  it('publishes a valid new form and stamps it', async () => {
    await create('');
    const data = TestBed.inject(MockDataService);
    TestBed.inject(SessionService).loginAs('admin');

    component['setName']('Callback request');
    component['addField']('TextInput');
    component['setFieldLabel'](component['selectedScreen']()!.fields[0]!, 'Best number');

    await component['saveAndPublish']();

    const saved = data.whatsappFlows().find((form) => form.name === 'Callback request')!;
    expect(saved.status).toBe('published');
    expect(saved.publishedAt).not.toBeNull();
    expect(component['error']()).toBeNull();
  });
});
