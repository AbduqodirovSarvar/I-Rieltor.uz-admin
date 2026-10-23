import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from './permission.service';

/**
 * Shows the element only to a user who has the permission (or any of them):
 * `<button *appHasPermission="'DELETE_USER'">` or `*appHasPermission="['READ_USER', 'READ_USERROLE']"`.
 * This hides controls; the backend still checks every call.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  readonly appHasPermission = input.required<string | readonly string[]>();

  private readonly permissions = inject(PermissionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const list = typeof required === 'string' ? [required] : required;
      const allowed = this.permissions.hasAny(list);
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}
