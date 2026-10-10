import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { CLIENT_MENU } from '../../core/navigation/menu-catalog';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/**
 * The cross-tier module matrix (`/plans/matrix`): rows are client modules,
 * columns are tiers, and every checkbox writes straight to the live plan row
 * that `PermissionService.planModules` gates the sidebar on.
 */
@Component({
  selector: 'app-feature-matrix-page',
  imports: [RouterLink, PageHeader, StatusPill],
  templateUrl: './feature-matrix-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureMatrixPage {
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly canEdit = computed(() => this.permissions.can('plans.manage', 'edit'));

  protected readonly modules = CLIENT_MENU.filter((entry) => !entry.hidden);

  protected readonly plans = computed(() => this.data.plans());

  protected hasModule(tier: string, moduleKey: string): boolean {
    return this.data.planForTier(tier)?.modules.includes(moduleKey) ?? false;
  }

  protected toggle(tier: string, moduleKey: string, enabled: boolean): void {
    if (!this.canEdit()) {
      return;
    }
    this.data.setPlanModule(tier, moduleKey, enabled);
  }

  protected tierCount(tier: string): number {
    return this.data.tenants().filter((tenant) => tenant.subscriptionTier === tier).length;
  }
}
