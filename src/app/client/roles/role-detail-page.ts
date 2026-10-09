import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import type { MenuKey, Role } from '../../core/authorization/role.model';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

@Component({
  selector: 'app-role-detail-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './role-detail-page.html',
  styleUrl: './role-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleDetailPage {
  readonly roleId = input<string>();

  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly roleName = signal('');
  protected readonly roleDescription = signal('');
  protected readonly savedNotice = signal<string | null>(null);

  protected readonly role = computed<Role | null>(() => this.permissions.roleFor(this.roleId()));

  protected readonly catalogue = computed(() => this.permissions.catalogue());

  constructor() {
    effect(() => {
      const current = this.role();
      if (current) {
        this.roleName.set(current.name);
        this.roleDescription.set(current.description ?? '');
      }
    });
  }

  protected isMenuChecked(menuKey: MenuKey): boolean {
    const r = this.role();
    return r ? r.menus.includes(menuKey) : false;
  }

  protected toggleMenu(menuKey: MenuKey): void {
    const r = this.role();
    if (!r) return;
    this.permissions.toggleMenu(r.id, menuKey);
  }

  protected saveDetails(): void {
    const r = this.role();
    if (!r) return;

    const updated: Role = {
      ...r,
      name: this.roleName(),
      description: this.roleDescription(),
    };
    this.permissions.saveRole(updated);
    this.savedNotice.set('Role details saved successfully.');
    setTimeout(() => this.savedNotice.set(null), 3000);
  }
}
