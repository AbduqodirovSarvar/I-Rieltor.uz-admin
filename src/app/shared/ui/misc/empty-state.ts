import { Component, input } from '@angular/core';

/** An empty list, an unavailable section, a failed load: an icon, a message and (projected) an action. */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="box">
      <i [class]="icon()"></i>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      color: var(--p-text-muted-color);
      text-align: center;
    }
    i {
      font-size: 2rem;
    }
    p {
      margin: 0;
    }
  `,
})
export class EmptyState {
  readonly message = input.required<string>();
  readonly icon = input('pi pi-inbox');
}
