import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { Tenant } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatNumber, formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/** The onboarded-client list the platform team lives in. */
@Component({
  selector: 'app-clients-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  template: `
    <div class="workspace-page">
      <app-page-header
        eyebrow="PLATFORM"
        title="Clients"
        description="Every onboarded business is a tenant workspace with its own subdomain, users, WhatsApp assets and configuration."
      >
        <a class="button button-secondary" pageActions routerLink="/plans">Plans & features</a>
        @if (canManage()) {
          <a class="button button-primary" pageActions routerLink="/clients/new">Onboard client</a>
        }
      </app-page-header>

      @if (notice(); as text) {
        <p class="login-status" role="status">
          {{ text }}
          <button class="form-link" type="button" (click)="notice.set(null)">Dismiss</button>
        </p>
      }

      <app-data-table
        [columns]="columns()"
        [rows]="data.tenants()"
        [loading]="loading()"
        caption="Onboarded client workspaces"
        exportName="bugconnect-clients"
        searchPlaceholder="Search by business or subdomain"
        emptyTitle="No clients match this filter"
        emptyDescription="Onboarded businesses appear here once their workspace is provisioned."
      >
        <ng-template appCell="businessName" let-tenant>
          <a class="data-table__primary data-table__link" [routerLink]="['/clients', tenant.id]">
            {{ tenant.businessName }}
          </a>
          <small class="data-table__subdued">{{ tenant.industry }}</small>
        </ng-template>

        <ng-template appCell="subdomain" let-tenant>
          <code class="data-table__mono">{{ tenant.subdomain }}.platform.com</code>
        </ng-template>

        <ng-template appCell="status" let-tenant>
          <app-status-pill [label]="statusLabel(tenant)" [tone]="statusTone(tenant)" />
        </ng-template>

        <ng-template appCell="metaWabaId" let-tenant>
          @if (tenant.metaWabaId) {
            <span class="data-table__mono">WABA {{ tenant.metaWabaId }}</span>
          } @else {
            <app-status-pill label="Not connected" tone="warning" />
          }
        </ng-template>

        <ng-template appCell="seatsUsed" let-tenant>
          {{ tenant.seatsUsed }}
        </ng-template>

        <ng-template appCell="contactCount" let-tenant>
          {{ contacts(tenant) }}
        </ng-template>

        <ng-template appCell="monthlyMessages" let-tenant>
          {{ formatCount(tenant.monthlyMessages) }}
        </ng-template>

        <ng-template appCell="createdAt" let-tenant>
          {{ since(tenant.createdAt) }}
        </ng-template>

        <ng-template appCell="actions" let-tenant>
          <span class="data-table__actions">
            <button class="data-table__action" type="button" (click)="openWorkspace(tenant)">
              View as
            </button>
            @if (canManage()) {
              <button class="data-table__action" type="button" (click)="toggleSuspension(tenant)">
                {{ tenant.status === 'suspended' ? 'Reactivate' : 'Suspend' }}
              </button>
            }
          </span>
        </ng-template>
      </app-data-table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  private readonly workspace = inject(WorkspaceContext);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('clients.manage', 'edit'));

  protected readonly columns = computed<DataColumn<Tenant>[]>(() => [
    { key: 'businessName', label: 'Client', sortable: true },
    { key: 'subdomain', label: 'Workspace address', sortable: true },
    { key: 'subscriptionTier', label: 'Plan', sortable: true, align: 'center' },
    { key: 'status', label: 'Lifecycle', sortable: true, align: 'center' },
    { key: 'metaWabaId', label: 'WhatsApp', sortable: true },
    { key: 'seatsUsed', label: 'Seats', sortable: true, align: 'center', type: 'number' },
    {
      key: 'contactCount',
      label: 'Contacts',
      sortable: true,
      align: 'end',
      type: 'number',
      value: (tenant) => tenant.contactCount,
    },
    {
      key: 'monthlyMessages',
      label: 'Messages / 30d',
      sortable: true,
      align: 'end',
      type: 'number',
      value: (tenant) => tenant.monthlyMessages,
    },
    { key: 'createdAt', label: 'Onboarded', sortable: true, value: (tenant) => tenant.createdAt },
    { key: 'actions', label: '', align: 'end' },
  ]);

  protected contacts(tenant: Tenant): string {
    return formatNumber(tenant.contactCount);
  }

  protected formatCount(value: number): string {
    return formatNumber(value);
  }

  protected since(iso: string): string {
    return formatRelative(iso);
  }

  protected statusLabel(tenant: Tenant): string {
    switch (tenant.status) {
      case 'lead_trial':
        return 'Lead / trial';
      case 'onboarding':
        return 'Onboarding';
      case 'whatsapp_pending':
        return 'Connection pending';
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      default:
        return 'Archived';
    }
  }

  protected statusTone(tenant: Tenant): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (tenant.status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'danger';
      case 'whatsapp_pending':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'info';
    }
  }

  /** Dev-only convenience: hop into a client workspace without changing hosts. */
  protected openWorkspace(tenant: Tenant): void {
    if (!this.workspace.canOverride()) {
      this.notice.set(
        `Subdomain switching needs a dev host. Point your browser at ${tenant.subdomain}.localhost:4200 to open this workspace.`,
      );
      return;
    }

    this.workspace.setDevWorkspace(tenant.subdomain);
    void this.router.navigate(['/']);
  }

  protected toggleSuspension(tenant: Tenant): void {
    const next = tenant.status === 'suspended' ? 'active' : 'suspended';

    this.loading.set(true);
    this.data.setTenantStatus(tenant.id, next).then(() => {
      this.loading.set(false);
      this.notice.set(
        `${tenant.businessName} is now ${this.statusLabel({ ...tenant, status: next }).toLowerCase()}.`,
      );
    });
  }
}
