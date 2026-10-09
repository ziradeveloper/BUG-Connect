import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { WorkspaceUser } from '../../../core/data/entities';
import { PageHeader } from '../../../shared/ui/ui';

/**
 * Create or edit one workspace member. Role select drives everything downstream:
 * the chosen role decides the member's menus, and capacity feeds the router.
 */
@Component({
  selector: 'app-user-form-page',
  imports: [FormsModule, RouterLink, PageHeader],
  templateUrl: './user-form-page.html',
  styleUrl: './user-form-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormPage {
  private readonly router = inject(Router);
  private readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  readonly userId = input<string | null>(null);

  protected readonly teams = ['Sales counter', 'Support desk', 'Billing desk'];
  protected readonly attempted = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected draft: {
    fullName: string;
    email: string;
    roleId: string;
    department: string;
    maxActiveChatCapacity: number;
    phone: string;
  } = {
    fullName: '',
    email: '',
    roleId: 'role-agent',
    department: 'Support desk',
    maxActiveChatCapacity: 5,
    phone: '',
  };

  protected readonly isEdit = computed(() => Boolean(this.userId()));

  protected readonly roles = computed(() => this.permissions.assignableRoles());

  protected readonly selectedRole = computed(() => this.permissions.roleFor(this.draft.roleId));

  protected readonly menuSummary = computed(() => {
    const role = this.selectedRole();
    return role ? `${role.menus.length} menu(s) open for this role` : 'No role selected yet';
  });

  constructor() {
    const data = this.data;

    effect(() => {
      const id = this.userId();
      const users = data.users();
      const existing = id ? users.find((user) => user.id === id) : undefined;

      if (existing) {
        this.draft = {
          fullName: existing.fullName,
          email: existing.email,
          roleId: existing.roleId,
          department: existing.department,
          maxActiveChatCapacity: existing.maxActiveChatCapacity,
          phone: existing.phone,
        };
      }
    });
  }

  protected submit(form: NgForm): void {
    this.attempted.set(true);

    if (form.invalid) {
      this.notice.set('Check the highlighted fields before saving.');
      return;
    }

    this.saving.set(true);
    const id = this.userId();

    this.data.saveUser({ ...this.draft, ...(id ? { id } : {}) }).then(() => {
      this.saving.set(false);
      void this.router.navigate(['/users']);
    });
  }
}
