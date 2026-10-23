import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EMPTY, Observable, catchError, concatMap, forkJoin, from, toArray } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { ApiError } from '../../core/http/api-error';
import { I18n, TextKey } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { HasUnsavedChanges } from '../../core/forms/unsaved-changes.guard';
import { Notify } from '../../core/notify/notify.service';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Role, RoleService } from './role.service';
import { RolePermission, RolePermissionService } from './role-permission.service';

/** The columns that most entities have; other actions (ASSIGN...) go to the "other" column. */
const MAIN_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'] as const;

interface Row {
  entity: string;
  label: string;
  /** Permission name per main action, or null when this entity has no such permission. */
  main: (string | null)[];
  other: { name: string; label: string }[];
}

/** A matrix of sections × actions for one role. Changes are collected and saved together. */
@Component({
  selector: 'app-role-permissions-page',
  imports: [ButtonModule, PageHeader, HasPermissionDirective, TPipe],
  templateUrl: './role-permissions-page.html',
  styleUrl: './role-permissions-page.scss',
})
export class RolePermissionsPage implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roles = inject(RoleService);
  private readonly permissions = inject(RolePermissionService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly roleId = this.route.snapshot.paramMap.get('id') as string;
  protected readonly role = signal<Role | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  private readonly names = signal<string[]>([]);
  /** Permission name → id of the stored role-permission (what the role has now). */
  private readonly stored = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly mainActions = MAIN_ACTIONS.map((action) => ({
    action,
    label: this.label(`permissions.actions.${action}`, action),
  }));

  protected readonly rows = computed<Row[]>(() => {
    const byEntity = new Map<string, Row>();
    for (const name of this.names()) {
      const underscore = name.indexOf('_');
      if (underscore < 0) continue;
      const action = name.slice(0, underscore);
      const entity = name.slice(underscore + 1);
      const row =
        byEntity.get(entity) ??
        ({
          entity,
          label: this.label(`permissions.entities.${entity}`, entity),
          main: MAIN_ACTIONS.map(() => null),
          other: [],
        } as Row);
      const index = (MAIN_ACTIONS as readonly string[]).indexOf(action);
      if (index >= 0) row.main[index] = name;
      else row.other.push({ name, label: this.label(`permissions.actions.${action}`, action) });
      byEntity.set(entity, row);
    }
    return [...byEntity.values()].sort((a, b) => a.label.localeCompare(b.label, 'uz'));
  });

  protected readonly added = computed(() =>
    [...this.selected()].filter((name) => !this.stored().has(name)),
  );
  protected readonly removed = computed(() =>
    [...this.stored().keys()].filter((name) => !this.selected().has(name)),
  );
  protected readonly dirty = computed(() => this.added().length + this.removed().length > 0);
  protected readonly isOwnRole = computed(
    () => this.auth.currentUser()?.userRoleId === this.roleId,
  );

  ngOnInit(): void {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  protected has(name: string | null): boolean {
    return name !== null && this.selected().has(name);
  }

  protected toggle(name: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  /** Every permission of a row, or none when they are all on already. */
  protected toggleRow(row: Row): void {
    const all = [
      ...row.main.filter((n): n is string => n !== null),
      ...row.other.map((o) => o.name),
    ];
    const everything = all.every((name) => this.selected().has(name));
    this.selected.update((current) => {
      const next = new Set(current);
      for (const name of all) {
        if (everything) next.delete(name);
        else next.add(name);
      }
      return next;
    });
  }

  protected rowChecked(row: Row): boolean {
    const all = [
      ...row.main.filter((n): n is string => n !== null),
      ...row.other.map((o) => o.name),
    ];
    return all.length > 0 && all.every((name) => this.selected().has(name));
  }

  protected reset(): void {
    this.selected.set(new Set(this.stored().keys()));
  }

  protected save(): void {
    if (!this.dirty() || this.saving()) return;
    this.saving.set(true);
    const failures: string[] = [];
    const ops = [
      ...this.added().map((name) => ({ name, run: () => this.permissions.add(this.roleId, name) })),
      ...this.removed().map((name) => ({
        name,
        run: () => this.permissions.remove(this.stored().get(name) as string),
      })),
    ];
    from(ops)
      .pipe(
        concatMap((op) =>
          (op.run() as Observable<unknown>).pipe(
            catchError((error: unknown) => {
              failures.push(`${op.name}: ${ApiError.from(error).message}`);
              return EMPTY;
            }),
          ),
        ),
        toArray(),
      )
      .subscribe(() => {
        this.saving.set(false);
        if (failures.length === 0) this.notify.success(this.i18n.t('permissions.saved'));
        else
          this.notify.error(
            new ApiError(0, failures.join('\n')),
            this.i18n.t('permissions.partial'),
          );
        this.load(true);
      });
  }

  protected back(): void {
    void this.router.navigate(['/roles']);
  }

  private load(quiet = false): void {
    if (!quiet) this.loading.set(true);
    forkJoin({
      names: this.permissions.allNames(),
      current: this.permissions.forRole(this.roleId),
      role: this.roles.get(this.roleId),
    }).subscribe({
      next: ({ names, current, role }) => {
        this.names.set(names);
        this.role.set(role);
        const stored = new Map<string, string>(
          current.map((p: RolePermission) => [p.permission ?? '', p.id] as [string, string]),
        );
        this.stored.set(stored);
        this.selected.set(new Set(stored.keys()));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error);
        this.loading.set(false);
        this.back();
      },
    });
  }

  private label(key: string, fallback: string): string {
    const text = this.i18n.t(key as TextKey);
    return text === key ? fallback : text;
  }
}
