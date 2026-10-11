import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import type { WaFormScreen } from './entities';
import { buildDataset } from './mock-data';
import { MockDataService } from './mock-data.service';
import { componentSpec, validateFlow } from './whatsapp-flows';

/**
 * Wave 6 data layer: the seeded native WhatsApp forms, tenant isolation and the
 * service write path (save → publish → archive) with its audit trail.
 */
describe('MockDataService (WhatsApp Flows / wave 6)', () => {
  let data: MockDataService;
  let tenantId: string;

  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  function configure(): MockDataService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
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
    });

    return TestBed.inject(MockDataService);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    data = configure();
    tenantId = data.currentTenant()?.id as string;
  });

  it('seeds three forms per tenant with their own screens and fields', () => {
    const dataset = buildDataset();

    for (const tenant of dataset.tenants) {
      const forms = dataset.whatsappFlows.filter((form) => form.tenantId === tenant.id);
      expect(forms.length, tenant.subdomain).toBe(3);

      for (const form of forms) {
        expect(form.screens.length).toBeGreaterThan(0);
        expect(form.screens.some((screen) => screen.terminal)).toBe(true);
        expect(
          form.screens.some((screen) =>
            screen.fields.some((field) => componentSpec(field.type).collects),
          ),
          form.name,
        ).toBe(true);
      }
    }
  });

  it('only publishes forms for a workspace that has connected WhatsApp', () => {
    const dataset = buildDataset();

    for (const tenant of dataset.tenants) {
      const forms = dataset.whatsappFlows.filter((form) => form.tenantId === tenant.id);
      const connected = tenant.status === 'active';

      for (const form of forms) {
        if (connected) {
          expect(['published', 'pending', 'draft']).toContain(form.status);
        } else {
          expect(form.status, `${tenant.subdomain}/${form.name}`).toBe('draft');
        }

        if (form.status === 'published') {
          expect(form.publishedAt).not.toBeNull();
          expect(form.submissions30d).toBeGreaterThan(0);
        } else {
          expect(form.publishedAt).toBeNull();
          expect(form.submissions30d).toBe(0);
        }
      }
    }
  });

  it('seeds forms that Meta would accept', () => {
    for (const form of buildDataset().whatsappFlows) {
      expect(validateFlow(form), form.name).toEqual([]);
    }
  });

  it('keeps the workspace scope to its own forms', () => {
    expect(data.whatsappFlows().length).toBe(3);
    for (const form of data.whatsappFlows()) {
      expect(form.tenantId).toBe(tenantId);
    }
    expect(data.waFlowById(`${tenantId}-waf-1`)).not.toBeNull();
    expect(data.waFlowById('tenant-2-waf-1')).toBeNull();
    expect(data.waFlowById(null)).toBeNull();
  });

  it('names the chat flow that sends a published form', () => {
    const published = data.whatsappFlows().find((form) => form.status === 'published');

    expect(published).toBeTruthy();
    expect(data.linkedFlowFor(published!.id)?.tenantId).toBe(tenantId);
  });

  it('stays deterministic across builds', () => {
    const first = buildDataset().whatsappFlows;
    const second = buildDataset().whatsappFlows;

    expect(second).toEqual(first);
  });

  it('saves a new draft and leaves an audit row', async () => {
    const screens: WaFormScreen[] = [
      {
        id: 'LEAD_CAPTURE',
        title: 'Tell us about you',
        subtitle: null,
        terminal: true,
        nextScreenId: null,
        footerLabel: 'Send',
        fields: [
          {
            id: 'f1',
            type: 'TextInput',
            label: 'Your name',
            name: 'full_name',
            required: true,
            inputType: 'text',
          },
        ],
      },
    ];

    const saved = await data.saveWhatsAppFlow({
      name: 'Walk-in enquiry',
      category: 'LEAD_GENERATION',
      screens,
      linkedFlowId: null,
    });

    expect(saved.id).toBeTruthy();
    expect(saved.status).toBe('draft');
    expect(data.waFlowById(saved.id)?.screens[0]?.id).toBe('LEAD_CAPTURE');

    const audit = data.auditForTenant(tenantId);
    expect(audit.some((event) => event.area === 'flows' && event.target.includes('Walk-in enquiry'))).toBe(
      true,
    );
  });

  it('refuses to publish a form Meta would reject, and publishes a good one', async () => {
    const broken = await data.saveWhatsAppFlow({
      name: 'Broken form',
      screens: [
        {
          id: 'ONE',
          title: '',
          subtitle: null,
          terminal: false,
          nextScreenId: 'GONE',
          footerLabel: 'Go',
          fields: [],
        },
      ],
    });

    const refused = await data.setWaFormStatus(broken.id, 'published');
    expect(refused.error).toBeTruthy();
    expect(refused.form?.status).toBe('draft');
    expect(data.waFlowById(broken.id)?.status).toBe('draft');
    expect(data.waFlowById(broken.id)?.publishedAt).toBeNull();

    const good = await data.saveWhatsAppFlow({
      name: 'Working form',
      screens: [
        {
          id: 'LEAD',
          title: 'Tell us about you',
          subtitle: null,
          terminal: true,
          nextScreenId: null,
          footerLabel: 'Send',
          fields: [
            {
              id: 'f1',
              type: 'TextInput',
              label: 'Your name',
              name: 'full_name',
              required: true,
              inputType: 'text',
            },
          ],
        },
      ],
    });

    const published = await data.setWaFormStatus(good.id, 'published');
    expect(published.error).toBeNull();
    expect(published.form?.status).toBe('published');
    expect(data.waFlowById(good.id)?.publishedAt).not.toBeNull();
    expect(
      data
        .auditForTenant(tenantId)
        .some((event) => event.action.includes('Published the Working form')),
    ).toBe(true);
  });

  it('archives and un-publishes through the same write path', async () => {
    const published = data.whatsappFlows().find((form) => form.status === 'published')!;

    const archived = await data.setWaFormStatus(published.id, 'archived');
    expect(archived.error).toBeNull();
    expect(archived.form?.status).toBe('archived');

    const drafted = await data.setWaFormStatus(published.id, 'draft');
    expect(drafted.form?.status).toBe('draft');

    const missing = await data.setWaFormStatus('nope', 'published');
    expect(missing.form).toBeNull();
    expect(missing.error).toBe('Form not found.');
  });

  it('deletes drafts only', async () => {
    const published = data.whatsappFlows().find((form) => form.status === 'published')!;
    const draft = await data.saveWhatsAppFlow({
      name: 'Scratch form',
      screens: [
        {
          id: 'SCRATCH',
          title: 'Scratch',
          subtitle: null,
          terminal: true,
          nextScreenId: null,
          footerLabel: 'Send',
          fields: [
            {
              id: 'f1',
              type: 'TextInput',
              label: 'Name',
              name: 'full_name',
              required: true,
              inputType: 'text',
            },
          ],
        },
      ],
    });

    expect(await data.deleteWhatsAppFlow(published.id)).toBe(false);
    expect(data.waFlowById(published.id)).not.toBeNull();

    expect(await data.deleteWhatsAppFlow(draft.id)).toBe(true);
    expect(data.waFlowById(draft.id)).toBeNull();
    expect(data.waFlowById('never-existed')).toBeNull();
    expect(await data.deleteWhatsAppFlow('never-existed')).toBe(false);
  });
});
