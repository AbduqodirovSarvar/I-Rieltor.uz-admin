import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { PermissionService } from '../../core/auth/permission.service';
import { DateTimePipe, PhonePipe } from '../../core/format/format';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { Role, RoleService } from '../roles/role.service';
import { User, UserService } from './user.service';

@Component({
  selector: 'app-user-detail',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    SelectModule,
    HasPermissionDirective,
    KeyValue,
    PageHeader,
    StatusBadge,
    DateTimePipe,
    PhonePipe,
    TPipe,
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly users = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);
  private readonly me = inject(PermissionService).userId;

  protected readonly id = this.route.snapshot.paramMap.get('id') as string;
  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal(true);

  protected readonly roleDialog = signal(false);
  protected readonly roles = signal<Role[]>([]);
  protected selectedRole: string | null = null;
  protected readonly savingRole = signal(false);

  protected get isMe(): boolean {
    return this.me() === this.id;
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.users.get(this.id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error, this.i18n.t('users.notFound'));
        void this.router.navigate(['/users']);
      },
    });
  }

  protected async remove(): Promise<void> {
    const user = this.user();
    if (!user) return;
    const name = user.fullName || user.login || '';
    if (!(await this.notify.confirmDelete(this.i18n.t('users.deleteConfirm', { name })))) return;
    this.users.delete(user.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        void this.router.navigate(['/users']);
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }

  protected openRoleDialog(): void {
    this.selectedRole = this.user()?.userRoleId ?? null;
    this.roleDialog.set(true);
    if (this.roles().length === 0)
      this.roleService.all().subscribe((roles) => this.roles.set(roles));
  }

  protected saveRole(): void {
    if (!this.selectedRole || this.savingRole()) return;
    this.savingRole.set(true);
    this.users.assignRole(this.id, this.selectedRole).subscribe({
      next: (user) => {
        this.savingRole.set(false);
        this.roleDialog.set(false);
        this.user.set(user);
        this.notify.success(this.i18n.t('users.roleAssigned'));
      },
      error: (error: unknown) => {
        this.savingRole.set(false);
        this.notify.error(error);
      },
    });
  }
}
