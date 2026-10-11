import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { DeveloperPage } from './developer-page';

/**
 * Developer Hub (`/developer`, wave 6).
 *
 * The hub's two promises, checked here: the snippets are generated from this
 * workspace's own rows, and a secret only ever appears in the panel that minted
 * it — never in the key table.
 */
describe('DeveloperPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: DeveloperPage;
  let fixture: ComponentFixture<DeveloperPage>;
  let data: MockDataService;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [DeveloperPage],
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

    data = TestBed.inject(MockDataService);
    fixture = TestBed.createComponent(DeveloperPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('documents this workspace’s own base URL, keys and endpoint', () => {
    expect(component['base']()).toBe('https://nazeel.api.bugconnect.dev/v1');
    expect(text()).toContain('https://nazeel.api.bugconnect.dev/v1');
    expect(component['keys']()).toHaveLength(data.apiKeys().length);
    expect(component['summary']().keys).toBe(data.apiKeys().length);
    expect(component['summary']().calls30d).toBe(
      data.apiKeys().reduce((total, key) => total + key.calls30d, 0),
    );
    expect(component['endpoint']()?.tenantId).toBe(data.currentTenant()?.id);
    expect(text()).toContain('Developer Hub');
    expect(text()).toContain('API keys');
    expect(text()).toContain('Webhook endpoint');
    expect(text()).toContain('Snippets');
  });

  it('reads each key’s state for the pill', () => {
    const states = component['keys']().map((key) => component['stateLabel'](key));

    expect(states.length).toBe(2);
    expect(states.every((label) => ['Live', 'Expiring soon', 'Expired', 'Revoked'].includes(label))).toBe(
      true,
    );

    for (const key of component['keys']()) {
      const tone = component['stateTone'](key);

      expect(['success', 'warning', 'danger', 'neutral']).toContain(tone);

      if (key.revokedAt) {
        expect(component['stateLabel'](key)).toBe('Revoked');
        expect(tone).toBe('danger');
      }
    }

    expect(['success', 'warning', 'danger', 'neutral']).toContain(component['endpointTone']());
  });

  it('generates a Postman collection this key could actually use', () => {
    const snippet = component['snippetText']();
    const parsed = JSON.parse(snippet) as {
      info: { name: string };
      variable: { key: string; value: string }[];
      item: unknown[];
    };

    expect(component['snippet']()).toBe('postman');
    expect(parsed.info.name).toContain('Nazeel');
    expect(parsed.variable[0]!.value).toBe('https://nazeel.api.bugconnect.dev/v1');
    // The prefix belongs to a real key in this workspace.
    expect(component['keys']().some((key) => key.prefix === parsed.variable[1]!.value)).toBe(true);
    expect(parsed.item.length).toBeGreaterThan(0);
    expect(component['snippetFilename']()).toBe('bugconnect-nazeel-collection.json');
    expect(component['snippetLabel']()).toBe('Postman collection (v2.1)');
  });

  it('switches snippets and keeps the sample delivery on screen', () => {
    component['setSnippet']('curl');
    fixture.detectChanges();

    expect(component['snippetText']()).toContain('curl -X POST');
    expect(component['snippetFilename']()).toBe('bugconnect-nazeel-send.sh');
    expect(text()).toContain('curl — send a template message');

    component['setSnippet']('signature');
    fixture.detectChanges();

    expect(component['snippetText']()).toContain('x-bugconnect-signature');
    expect(component['snippetFilename']()).toBe('bugconnect-webhook-verify.mjs');
    // The endpoint's real signing secret is the one the example verifies.
    expect(component['snippetText']()).toContain(data.webhookEndpoint()!.secret);
    expect(JSON.parse(component['deliverySample']()).type).toBe(
      data.webhookEndpoint()!.events[0],
    );
  });

  it('refuses a nameless or scopeless key before it reaches the service', async () => {
    component['openKeyForm']();
    fixture.detectChanges();

    expect(component['showKeyForm']()).toBe(true);

    await component['createKey']();

    expect(component['keyFormError']()).toContain('Name the key');
    expect(component['keys']()).toHaveLength(2);

    component['keyName'].set('Sync job');
    component['toggleScope']('messages.send');
    await component['createKey']();

    expect(component['keyFormError']()).toContain('at least one scope');
    expect(component['keys']()).toHaveLength(2);

    // The form never closed on a failed attempt.
    expect(component['showKeyForm']()).toBe(true);
  });

  it('issues a key and shows the secret exactly once', async () => {
    component['openKeyForm']();
    component['keyName'].set('Nightly sync');
    component['keyScopes'].set(['contacts.write']);

    await component['createKey']();
    fixture.detectChanges();

    const granted = component['issued']();

    expect(granted).not.toBeNull();
    expect(granted!.secret).toMatch(/^bc_secret_/);
    expect(text()).toContain(granted!.key.name);
    expect(text()).toContain('will not be shown again');
    // The form closed and the key is on the list.
    expect(component['showKeyForm']()).toBe(false);
    expect(component['keys']()).toHaveLength(3);

    // Dismissing it is the only way the secret leaves the screen.
    component['dismissIssued']();
    fixture.detectChanges();

    expect(component['issued']()).toBeNull();
    expect(text()).not.toContain(granted!.secret);
  });

  it('masks a secret until it is revealed', async () => {
    component['openKeyForm']();
    component['keyName'].set('Masked');
    component['keyScopes'].set(['flows.read']);
    await component['createKey']();

    expect(component['secretRevealed']()).toBe(true);

    component['secretRevealed'].set(false);
    fixture.detectChanges();

    expect(text()).not.toContain(component['issued']()!.secret);
    expect(text()).toContain('•'.repeat(38));
  });

  it('validates the endpoint URL before saving', async () => {
    component['webhookUrl'].set('http://insecure.example.com/hook');
    component['webhookEvents'].set(['message.received']);

    await component['saveWebhook']();

    expect(component['webhookFormError']()).toContain('https');
    expect(data.webhookEndpoint()?.url).not.toBe('http://insecure.example.com/hook');

    component['webhookUrl'].set('https://crm.nazeel.example.com/v2');
    component['webhookEvents'].set([]);

    await component['saveWebhook']();

    expect(component['webhookFormError']()).toContain('at least one event');

    component['webhookEvents'].set(['message.received', 'contact.opt_out']);

    await component['saveWebhook']();
    fixture.detectChanges();

    expect(component['webhookFormError']()).toBeNull();
    expect(data.webhookEndpoint()?.url).toBe('https://crm.nazeel.example.com/v2');
    expect(text()).toContain('crm.nazeel.example.com/v2');
  });

  it('tests a delivery and reports what the receiver answered', async () => {
    await data.setWebhookStatus('active');
    fixture.detectChanges();

    await component['testWebhook']();
    fixture.detectChanges();

    expect(component['testResult']()?.status).toBe(200);
    expect(text()).toContain('HTTP 200');

    // A paused endpoint cannot be tested.
    await data.setWebhookStatus('paused');
    await component['testWebhook']();

    expect(component['error']()).toContain('Resume the endpoint');
  });
});
