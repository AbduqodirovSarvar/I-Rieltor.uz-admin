import { Component, input } from '@angular/core';

/** A label and its value in a detail view; the value can be given as text or projected (`<app-key-value label="Holat"><app-status-badge .../></app-key-value>`). */
@Component({
  selector: 'app-key-value',
  template: `
    <div class="row">
      <dt>{{ label() }}</dt>
      <dd>
        @if (value() !== null && value() !== undefined && value() !== '') {
          {{ value() }}
        } @else {
          <ng-content>—</ng-content>
        }
      </dd>
    </div>
  `,
  styles: `
    .row {
      display: grid;
      grid-template-columns: minmax(8rem, 12rem) 1fr;
      gap: 0.75rem;
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    dt {
      color: var(--p-text-muted-color);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class KeyValue {
  readonly label = input.required<string>();
  readonly value = input<string | number | null | undefined>(null);
}
