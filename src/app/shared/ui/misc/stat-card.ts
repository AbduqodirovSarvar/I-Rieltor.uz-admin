import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One number with a title, a small note and an icon; with `link` the whole card opens that page. */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    @if (link(); as target) {
      <a class="card" [routerLink]="target"><ng-container *ngTemplateOutlet="body" /></a>
    } @else {
      <div class="card"><ng-container *ngTemplateOutlet="body" /></div>
    }
    <ng-template #body>
      <i [class]="icon()" [attr.data-tone]="tone()"></i>
      <div class="text">
        <span class="title">{{ title() }}</span>
        <strong class="value">{{ value() }}</strong>
        @if (note()) {
          <small>{{ note() }}</small>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      gap: 0.9rem;
      align-items: center;
      padding: 1rem 1.1rem;
      background: var(--p-surface-0);
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.75rem;
      color: inherit;
      text-decoration: none;
      height: 100%;
    }
    a.card:hover {
      border-color: var(--p-primary-color);
    }
    :host-context(.app-dark) .card {
      background: var(--p-surface-900);
    }
    i {
      font-size: 1.4rem;
      width: 2.8rem;
      height: 2.8rem;
      display: grid;
      place-items: center;
      border-radius: 0.6rem;
      background: var(--p-highlight-background);
      color: var(--p-primary-color);
    }
    i[data-tone='warn'] {
      background: var(--p-orange-100);
      color: var(--p-orange-600);
    }
    i[data-tone='success'] {
      background: var(--p-green-100);
      color: var(--p-green-600);
    }
    i[data-tone='danger'] {
      background: var(--p-red-100);
      color: var(--p-red-600);
    }
    /* Dark mode: a faint tint of the same colour instead of the light pastel. */
    :host-context(.app-dark) i[data-tone='warn'] {
      background: color-mix(in srgb, var(--p-orange-500) 18%, transparent);
      color: var(--p-orange-300);
    }
    :host-context(.app-dark) i[data-tone='success'] {
      background: color-mix(in srgb, var(--p-green-500) 18%, transparent);
      color: var(--p-green-300);
    }
    :host-context(.app-dark) i[data-tone='danger'] {
      background: color-mix(in srgb, var(--p-red-500) 18%, transparent);
      color: var(--p-red-300);
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .title {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
    }
    .value {
      font-size: 1.5rem;
      line-height: 1.2;
    }
    small {
      color: var(--p-text-muted-color);
    }
  `,
})
export class StatCard {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly note = input<string | null>(null);
  readonly icon = input('pi pi-chart-bar');
  readonly tone = input<'default' | 'warn' | 'success' | 'danger'>('default');
  readonly link = input<string | null>(null);
}
