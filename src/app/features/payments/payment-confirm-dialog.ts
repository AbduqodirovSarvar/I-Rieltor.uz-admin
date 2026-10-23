import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { firstValueFrom } from 'rxjs';
import { MoneyPipe } from '../../core/format/format';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FileUpload } from '../../shared/ui/file-upload/file-upload';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { DocumentService } from '../documents/document.service';
import { Payment, PaymentService } from './payment.service';

/**
 * Confirms a bank / card transfer (or completes a refund): shows what is to be paid, lets the staff attach the check they
 * received, and then marks the payment paid with the bank's reference.
 */
@Component({
  selector: 'app-payment-confirm-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    FileUpload,
    KeyValue,
    StatusBadge,
    MoneyPipe,
    TPipe,
  ],
  templateUrl: './payment-confirm-dialog.html',
  styleUrl: './payment-confirm-dialog.scss',
})
export class PaymentConfirmDialog {
  readonly payment = input.required<Payment>();
  readonly visible = model(false);
  /** `refund` completes a queued refund instead of confirming a payment. */
  readonly mode = input<'confirm' | 'refund'>('confirm');
  readonly done = output<Payment>();

  private readonly payments = inject(PaymentService);
  private readonly documents = inject(DocumentService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected reference = '';
  protected readonly busy = signal(false);
  protected readonly attaching = signal(false);
  protected readonly receipts = signal<Payment['receipts']>(null);
  private files: File[] = [];

  protected get title(): string {
    return this.i18n.t(this.mode() === 'refund' ? 'payments.refundTitle' : 'payments.confirmTitle');
  }

  protected get hint(): string {
    return this.i18n.t(this.mode() === 'refund' ? 'payments.refundHint' : 'payments.confirmHint');
  }

  protected opened(): void {
    this.reference = '';
    this.files = [];
    this.receipts.set(this.payment().receipts ?? []);
  }

  protected picked(files: File[]): void {
    this.files = files;
  }

  protected async attach(): Promise<void> {
    if (this.files.length === 0 || this.attaching()) return;
    this.attaching.set(true);
    const current = [...(this.receipts() ?? [])];
    try {
      for (const file of this.files) {
        const created = await firstValueFrom(
          this.documents.upload(file, { purpose: 'PAYMENT_RECEIPT', paymentId: this.payment().id }),
        );
        current.push({
          id: created.id,
          originalName: created.originalName ?? file.name,
          contentType: created.contentType ?? '',
          size: created.size,
          ownerId: created.ownerId,
          description: created.description,
          createdAt: created.createdAt,
        });
      }
      this.receipts.set(current);
      this.files = [];
      this.notify.success(this.i18n.t('payments.attached'));
    } catch (error) {
      this.notify.error(error);
    } finally {
      this.attaching.set(false);
    }
  }

  protected view(receipt: NonNullable<Payment['receipts']>[number]): void {
    this.documents.open({
      id: receipt.id,
      originalName: receipt.originalName,
      contentType: receipt.contentType,
    });
  }

  protected submit(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const payment = this.payment();
    const request =
      this.mode() === 'refund'
        ? this.payments.completeRefund(payment.id, this.reference)
        : this.payments.confirm(payment.id, this.reference);
    request.subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.visible.set(false);
        this.notify.success(
          this.i18n.t(this.mode() === 'refund' ? 'payments.refundDone' : 'payments.confirmed'),
        );
        this.done.emit(updated);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // 409 if someone confirmed it meanwhile; the list is refreshed by the caller on close.
        this.notify.error(error);
      },
    });
  }
}
