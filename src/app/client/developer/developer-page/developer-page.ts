import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PermissionService } from '../../../core/authorization/permission.service';
import {
  API_KEY_SCOPES,
  REQUESTS_PER_MINUTE,
  apiBaseFor,
  buildCurlExample,
  buildDeliverySample,
  buildPostmanCollection,
  buildSignatureExample,
  describeScopes,
  keyState,
  WEBHOOK_EVENT_OPTIONS,
  type HubContext,
} from '../../../core/data/developer-hub';
import type { ApiKeyScope, ApiKeyToken, WebhookEventName } from '../../../core/data/entities';
import { DATA_NOW } from '../../../shared/format';
import { MockDataService } from '../../../core/data/mock-data.service';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatDateTime, formatNumber, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

type SnippetTab = 'postman' | 'curl' | 'signature';

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: 'One year' },
  { value: 'never', label: 'No expiry' },
] as const;

type ExpiryChoice = (typeof EXPIRY_OPTIONS)[number]['value'];

/**
 * Developer Hub (`/developer`, wave 6).
 *
 * The workspace's own integration surface: scoped API keys with a real
 * lifecycle, one signed webhook endpoint, and a Postman collection generated
 * from what this key can actually do. Two rules drive the screen:
 *
 * 1. a secret is shown exactly once, at the moment it is minted, because the
 *    stored row only keeps a digest; and
 * 2. nothing here invents a value — the base URL, the sample template, the
 *    sample recipient and the endpoint all come from the workspace's own rows.
 */
@Component({
  selector: 'app-developer-page',
  imports: [
    FormsModule,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './developer-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeveloperPage {
  private readonly data = inject(MockDataService);
  private readonly document = inject(DOCUMENT);
  private readonly permissions = inject(PermissionService);

  protected readonly scopeOptions = API_KEY_SCOPES;
  protected readonly eventOptions = WEBHOOK_EVENT_OPTIONS;
  protected readonly expiryOptions = EXPIRY_OPTIONS;
  protected readonly rateLimit = REQUESTS_PER_MINUTE;
  protected readonly describeScopes = describeScopes;
  protected readonly formatNumber = formatNumber;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatRelative = formatRelative;

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('developer.manage', 'edit'));

  protected readonly keys = computed(() => this.data.apiKeys());
  protected readonly endpoint = computed(() => this.data.webhookEndpoint());
  protected readonly base = computed(() =>
    apiBaseFor(this.data.currentTenant() ?? { subdomain: 'workspace' }),
  );

  protected readonly summary = computed(() => {
    const live = this.keys().filter((key) => keyState(key, DATA_NOW) === 'live');

    return {
      keys: this.keys().length,
      live: live.length,
      calls30d: this.keys().reduce((total, key) => total + key.calls30d, 0),
      events: this.endpoint()?.events.length ?? 0,
    };
  });

  // ── key form ───────────────────────────────────────────────────────
  protected readonly showKeyForm = signal(false);
  protected readonly keyName = signal('');
  protected readonly keyScopes = signal<ApiKeyScope[]>(['messages.send']);
  protected readonly keyExpiry = signal<ExpiryChoice>('90');
  protected readonly keyFormError = signal<string | null>(null);

  /** A secret that exists only in this browser tab, until it is dismissed. */
  protected readonly issued = signal<{ key: ApiKeyToken; secret: string } | null>(null);
  protected readonly secretRevealed = signal(false);
  protected readonly pendingRevoke = signal<ApiKeyToken | null>(null);

  // ── webhook form ───────────────────────────────────────────────────
  protected readonly webhookUrl = signal('');
  protected readonly webhookEvents = signal<WebhookEventName[]>([]);
  protected readonly webhookFormError = signal<string | null>(null);
  protected readonly signingRevealed = signal(false);
  protected readonly testResult = signal<{ ok: boolean; status: number; latencyMs: number } | null>(
    null,
  );

  // ── snippets ───────────────────────────────────────────────────────
  protected readonly snippet = signal<SnippetTab>('postman');
  protected readonly snippetCopied = signal(false);

  protected readonly columns: DataColumn<ApiKeyToken>[] = [
    { key: 'name', label: 'Key', sortable: true, value: (key) => key.name },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      value: (key) => keyState(key, DATA_NOW),
    },
    {
      key: 'calls30d',
      label: 'Calls, 30d',
      align: 'end',
      sortable: true,
      format: (key) => formatNumber(key.calls30d),
    },
    {
      key: 'created',
      label: 'Issued',
      align: 'end',
      sortable: true,
      value: (key) => key.createdAt,
      format: (key) => formatRelative(key.createdAt),
    },
    {
      key: 'expires',
      label: 'Expires',
      align: 'end',
      sortable: true,
      value: (key) => key.expiresAt ?? '',
      format: (key) => (key.expiresAt ? formatDateTime(key.expiresAt) : 'Never'),
    },
    { key: 'actions', label: '', sortable: false, align: 'end' },
  ];

  /** The workspace's real integration details, for every generated snippet. */
  private readonly context = computed<HubContext>(() => {
    const tenant = this.data.currentTenant();
    const live =
      this.keys().find((key) => keyState(key, DATA_NOW) === 'live') ?? this.keys()[0] ?? null;
    const endpoint = this.endpoint();

    return {
      base: this.base(),
      workspace: tenant?.businessName ?? 'this workspace',
      subdomain: tenant?.subdomain ?? 'workspace',
      keyPrefix: live?.prefix ?? 'bc_live_your_key_here',
      scopes: live?.scopes ?? [],
      templateName: this.data.sendableTemplates()[0]?.name ?? 'order_update',
      sampleRecipient: this.data.contacts()[0]?.waId ?? '+91 98400 00000',
      webhook: endpoint ? { url: endpoint.url, secret: endpoint.secret, events: endpoint.events } : null,
    };
  });

  protected readonly snippetText = computed(() => {
    const context = this.context();

    switch (this.snippet()) {
      case 'curl':
        return buildCurlExample(context);
      case 'signature':
        return buildSignatureExample(context.webhook?.secret ?? 'whsec_your_signing_secret');
      default:
        return buildPostmanCollection(context);
    }
  });

  protected readonly snippetLabel = computed<string>(
    () =>
      (
        {
          postman: 'Postman collection (v2.1)',
          curl: 'curl — send a template message',
          signature: 'Node — verify a delivery signature',
        } as Record<SnippetTab, string>
      )[this.snippet()],
  );

  protected readonly snippetFilename = computed<string>(
    () =>
      (
        {
          postman: `bugconnect-${this.context().subdomain}-collection.json`,
          curl: `bugconnect-${this.context().subdomain}-send.sh`,
          signature: 'bugconnect-webhook-verify.mjs',
        } as Record<SnippetTab, string>
      )[this.snippet()],
  );

  /** The delivery a receiver should expect, next to the signing secret. */
  protected readonly deliverySample = computed(() => buildDeliverySample(this.context()));

  /** Keys are their own rows in the table's selection model. */
  protected readonly keyRowKey = (key: ApiKeyToken): string => key.id;

  protected keyState = (key: ApiKeyToken): 'live' | 'expiring' | 'expired' | 'revoked' =>
    keyState(key, DATA_NOW);

  protected stateLabel(key: ApiKeyToken): string {
    switch (keyState(key, DATA_NOW)) {
      case 'revoked':
        return 'Revoked';
      case 'expired':
        return 'Expired';
      case 'expiring':
        return 'Expiring soon';
      default:
        return 'Live';
    }
  }

  protected stateTone(key: ApiKeyToken): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (keyState(key, DATA_NOW)) {
      case 'revoked':
        return 'danger';
      case 'expired':
        return 'danger';
      case 'expiring':
        return 'warning';
      default:
        return 'success';
    }
  }

  protected endpointTone(): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (this.endpoint()?.status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'failing':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  // ── key actions ────────────────────────────────────────────────────

  protected openKeyForm(): void {
    this.showKeyForm.set(true);
    this.keyFormError.set(null);
  }

  protected closeKeyForm(): void {
    this.showKeyForm.set(false);
    this.keyName.set('');
    this.keyScopes.set(['messages.send']);
    this.keyExpiry.set('90');
    this.keyFormError.set(null);
  }

  protected toggleScope(scope: ApiKeyScope): void {
    this.keyScopes.update((current) =>
      current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope],
    );
  }

  protected toggleEvent(event: WebhookEventName): void {
    this.webhookEvents.update((current) =>
      current.includes(event) ? current.filter((entry) => entry !== event) : [...current, event],
    );
    this.webhookFormError.set(null);
  }

  protected async createKey(): Promise<void> {
    if (!this.keyName().trim()) {
      this.keyFormError.set('Name the key after what it is used for.');
      return;
    }

    if (this.keyScopes().length === 0) {
      this.keyFormError.set('Pick at least one scope — a key with none can do nothing.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const choice = this.keyExpiry();
      const issued = await this.data.createApiKey({
        name: this.keyName(),
        scopes: this.keyScopes(),
        expiresAt:
          choice === 'never'
            ? null
            : new Date(DATA_NOW + Number(choice) * 86_400_000).toISOString(),
      });

      this.issued.set(issued);
      this.secretRevealed.set(true);
      this.closeKeyForm();
      this.notice.set(`Key “${issued.key.name}” issued. Copy the secret now — it is shown once.`);
    } finally {
      this.loading.set(false);
    }
  }

  protected askRevoke(key: ApiKeyToken): void {
    this.pendingRevoke.set(key);
  }

  protected async confirmRevoke(): Promise<void> {
    const key = this.pendingRevoke();

    this.pendingRevoke.set(null);

    if (!key) return;

    this.loading.set(true);
    const revoked = await this.data.revokeApiKey(key.id);

    this.loading.set(false);
    this.notice.set(
      revoked
        ? `Key “${key.name}” revoked. Anything still holding it now gets 401.`
        : 'That key was already revoked.',
    );
  }

  protected async rotateKey(key: ApiKeyToken): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const rotated = await this.data.rotateApiKey(key.id);

      if (!rotated) {
        this.error.set('A revoked key cannot be rotated — issue a new one instead.');
        return;
      }

      this.issued.set(rotated);
      this.secretRevealed.set(true);
      this.notice.set(`Secret rotated for “${rotated.key.name}”. The old secret stops working now.`);
    } finally {
      this.loading.set(false);
    }
  }

  protected dismissIssued(): void {
    this.issued.set(null);
    this.secretRevealed.set(false);
  }

  // ── webhook actions ────────────────────────────────────────────────

  /** Loads the saved endpoint into the form, the way the studio loads a draft. */
  protected editWebhook(): void {
    const endpoint = this.endpoint();

    if (!endpoint) return;

    this.webhookUrl.set(endpoint.url);
    this.webhookEvents.set([...endpoint.events]);
    this.webhookFormError.set(null);
    this.testResult.set(null);
  }

  protected async saveWebhook(): Promise<void> {
    const url = this.webhookUrl().trim();

    if (!/^https:\/\/[^\s]+$/.test(url)) {
      this.webhookFormError.set('Deliveries only go to an https URL.');
      return;
    }

    if (this.webhookEvents().length === 0) {
      this.webhookFormError.set('Subscribe to at least one event.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    // A previous failed attempt must not survive a save that worked.
    this.webhookFormError.set(null);

    try {
      const saved = await this.data.saveWebhook({ url, events: this.webhookEvents() });

      this.notice.set(
        saved
          ? `Endpoint saved. ${saved.events.length} events will be delivered to ${saved.url}.`
          : 'The endpoint could not be saved.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async toggleWebhook(): Promise<void> {
    const endpoint = this.endpoint();

    if (!endpoint) return;

    this.loading.set(true);

    try {
      const next = await this.data.setWebhookStatus(
        endpoint.status === 'paused' ? 'active' : 'paused',
      );

      this.notice.set(
        next?.status === 'paused'
          ? 'Deliveries paused. Events are dropped, not queued — resume when the receiver is ready.'
          : 'Deliveries resumed.',
      );
      this.testResult.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected async testWebhook(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.testResult.set(null);

    try {
      const result = await this.data.sendTestWebhook();

      if (!result) {
        this.error.set('Resume the endpoint before sending a test delivery.');
        return;
      }

      this.testResult.set(result);
      this.notice.set(
        result.ok
          ? `Delivery accepted: HTTP ${result.status} in ${result.latencyMs} ms.`
          : `The receiver answered HTTP ${result.status}. Check its logs, then pause the endpoint if it stays down.`,
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async rotateSecret(): Promise<void> {
    this.loading.set(true);

    try {
      const next = await this.data.rotateWebhookSecret();

      this.signingRevealed.set(true);
      this.notice.set(
        next
          ? 'New signing secret generated. Update the receiver, or its signature checks will fail.'
          : 'There is no endpoint to rotate yet.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  // ── snippets ───────────────────────────────────────────────────────

  protected setSnippet(tab: SnippetTab): void {
    this.snippet.set(tab);
    this.snippetCopied.set(false);
  }

  protected async copySnippet(): Promise<void> {
    const clipboard = (globalThis as { navigator?: Navigator }).navigator?.clipboard;

    if (!clipboard) {
      this.error.set('This browser blocks clipboard access — select the snippet instead.');
      return;
    }

    try {
      await clipboard.writeText(this.snippetText());
      this.snippetCopied.set(true);
    } catch {
      this.error.set('The clipboard refused the copy.');
    }
  }

  protected downloadSnippet(): void {
    const view = this.document.defaultView;

    if (!view || typeof view.URL?.createObjectURL !== 'function') {
      this.error.set('This browser cannot build a download.');
      return;
    }

    const blob = new Blob([this.snippetText()], { type: 'text/plain' });
    const url = view.URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');

    anchor.href = url;
    anchor.download = this.snippetFilename();
    anchor.click();
    view.URL.revokeObjectURL(url);
  }

  protected async copyText(value: string): Promise<void> {
    const clipboard = (globalThis as { navigator?: Navigator }).navigator?.clipboard;

    if (!clipboard) {
      this.error.set('This browser blocks clipboard access — select the text instead.');
      return;
    }

    try {
      await clipboard.writeText(value);
      this.notice.set('Copied.');
    } catch {
      this.error.set('The clipboard refused the copy.');
    }
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
