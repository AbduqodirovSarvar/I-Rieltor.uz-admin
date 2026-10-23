import { Component, computed, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { enumSeverity } from '../../../core/i18n/enum-severity';
import { EnumName, I18n } from '../../../core/i18n/i18n.service';

/** `<app-status-badge enum="AuctionStatus" [value]="auction.status" />`: the label and colour of an enum value. */
@Component({
  selector: 'app-status-badge',
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
})
export class StatusBadge {
  readonly enum = input.required<EnumName>();
  readonly value = input<string | null | undefined>(null);

  private readonly i18n = inject(I18n);
  protected readonly label = computed(() => this.i18n.enumLabel(this.enum(), this.value()));
  protected readonly severity = computed(() => enumSeverity(this.enum(), this.value()));
}
