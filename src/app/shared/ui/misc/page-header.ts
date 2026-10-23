import { Component, input } from '@angular/core';

/** The title of a page with room for actions on the right: `<app-page-header title="..."><p-button .../></app-page-header>`. */
@Component({
  selector: 'app-page-header',
  template: `
    <header>
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0;
      font-size: 1.4rem;
    }
    p {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
