import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { Participant, ParticipantService } from './participant.service';

/** Approve / reject buttons of a pending application; rejecting asks for the reason the applicant will see. */
@Component({
  selector: 'app-participant-actions',
  imports: [FormsModule, ButtonModule, DialogModule, TextareaModule, HasPermissionDirective, TPipe],
  template: `
    @if (participant().status === 'PENDING') {
      <ng-container *appHasPermission="'UPDATE_AUCTIONPARTICIPANT'">
        <p-button
          icon="pi pi-check"
          [text]="true"
          severity="success"
          [loading]="busy()"
          (onClick)="approve()"
          [attr.aria-label]="'auctions.approve' | t"
        />
        <p-button
          icon="pi pi-times"
          [text]="true"
          severity="danger"
          (onClick)="open()"
          [attr.aria-label]="'auctions.reject' | t"
        />
      </ng-container>
    }
    <p-dialog
      [header]="'auctions.reject' | t"
      [(visible)]="dialog"
      [modal]="true"
      [style]="{ width: '26rem' }"
      appendTo="body"
    >
      <div class="dialog-form">
        <label for="rejectReason">{{ 'auctions.rejectReason' | t }}</label>
        <textarea
          pTextarea
          id="rejectReason"
          rows="3"
          maxlength="500"
          [(ngModel)]="reason"
        ></textarea>
        <div class="dialog-actions">
          <p-button
            [label]="'common.cancel' | t"
            severity="secondary"
            [text]="true"
            (onClick)="dialog.set(false)"
          />
          <p-button
            [label]="'auctions.reject' | t"
            severity="danger"
            [loading]="busy()"
            [disabled]="!reason.trim()"
            (onClick)="reject()"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class ParticipantActions {
  readonly participant = input.required<Participant>();
  /** Emits after a successful approve / reject, so the list reloads. */
  readonly changed = output<Participant>();

  private readonly service = inject(ParticipantService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly busy = signal(false);
  protected readonly dialog = signal(false);
  protected reason = '';

  protected open(): void {
    this.reason = '';
    this.dialog.set(true);
  }

  protected approve(): void {
    this.run(this.service.approve(this.participant().id), 'auctions.approved');
  }

  protected reject(): void {
    this.run(this.service.reject(this.participant().id, this.reason.trim()), 'auctions.rejected');
  }

  private run(
    request: ReturnType<ParticipantService['approve']>,
    message: 'auctions.approved' | 'auctions.rejected',
  ): void {
    this.busy.set(true);
    request.subscribe({
      next: (participant) => {
        this.busy.set(false);
        this.dialog.set(false);
        this.notify.success(this.i18n.t(message));
        this.changed.emit(participant);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // 409: the sale has started and applications can no longer be reviewed.
        this.notify.error(error);
      },
    });
  }
}
