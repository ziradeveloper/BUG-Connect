import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { SessionService } from '../../core/auth/session.service';
import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { formatDateTime, formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';
import { FormsModule } from '@angular/forms';

const API_VERSIONS = ['v22.0', 'v23.0', 'v24.0'];

/**
 * The platform's Meta app reference (`/meta-config`): app id, secret
 * reference, API version, the webhook callback and its verify token. Values
 * are pasted from Meta's dashboard and held in memory only — with dummy data
 * there is nothing live to read.
 */
@Component({
  selector: 'app-meta-config-page',
  imports: [FormsModule, PageHeader, StatusPill],
  templateUrl: './meta-config-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaConfigPage {
  private readonly session = inject(SessionService);
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly versions = API_VERSIONS;
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly secretVisible = signal(false);
  protected readonly copied = signal<string | null>(null);

  protected draft = { appId: '', appSecretRef: '', apiVersion: 'v24.0', testNumber: '' };

  protected readonly canEdit = computed(() => this.permissions.can('meta.manage', 'edit'));

  protected readonly config = computed(() => this.data.metaConfig());

  protected readonly configured = computed(() => this.config().appId.trim().length > 0);

  protected readonly numbers = computed(() =>
    this.data.tenants().map((tenant) => ({
      id: tenant.id,
      businessName: tenant.businessName,
      phoneNumber: tenant.phoneNumber,
      connected: Boolean(tenant.metaWabaId),
    })),
  );

  constructor() {
    effect(() => {
      const config = this.config();
      this.draft = {
        appId: config.appId,
        appSecretRef: config.appSecretRef,
        apiVersion: config.apiVersion,
        testNumber: config.testNumber,
      };
    });
  }

  protected updatedLabel(): string {
    const config = this.config();
    if (!config.updatedAt) {
      return 'Never saved — the platform still runs on the seeded reference.';
    }
    return `Saved ${formatRelative(config.updatedAt)} (${formatDateTime(config.updatedAt)})${config.updatedBy ? ` by ${config.updatedBy}` : ''}.`;
  }

  protected toggleSecret(): void {
    this.secretVisible.update((visible) => !visible);
  }

  protected async copy(field: 'callback' | 'token', value: string): Promise<void> {
    try {
      const clipboard = (globalThis as { navigator?: Navigator }).navigator?.clipboard;
      if (clipboard) {
        await clipboard.writeText(value);
        this.copied.set(field);
        setTimeout(() => this.copied.set(null), 2000);
        return;
      }
    } catch {
      // Clipboard blocked: fall through to the notice below.
    }
    this.notice.set('Copy is blocked in this browser — select the value manually.');
  }

  protected regenerateToken(): void {
    if (!this.canEdit()) {
      return;
    }
    const token = `BUGCONNECT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    this.data.saveMetaConfig({ verifyToken: token }, this.actor()).then(() => {
      this.notice.set('Verify token rotated. Paste it into Meta before the next delivery or webhooks will fail verification.');
    });
  }

  protected async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.notice.set(null);
    try {
      await this.data.saveMetaConfig({ ...this.draft }, this.actor());
      this.notice.set('Meta app reference saved. Embedded Signup and webhooks read these values.');
    } finally {
      this.saving.set(false);
    }
  }

  private actor(): string {
    return this.session.user()?.fullName ?? 'platform';
  }
}
