import { Component, computed, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MoneyPipe } from '../../core/format/format';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FileUpload } from '../../shared/ui/file-upload/file-upload';
import { Auction, AuctionService } from '../auctions/auction.service';
import { DocumentService } from '../documents/document.service';
import { Participant, ParticipantService } from '../participants/participant.service';
import { ManualPaymentInput, Payment, PaymentService } from './payment.service';

/**
 * Money the staff received outside the payment systems (cash desk, bank, card): pick the auction and the applicant, and the
 * amount is the one the system expects (the server rejects any other). An optional check is attached right after.
 */
@Component({
  selector: 'app-payment-manual-dialog',
  imports: [
    FormsModule,
    AutoCompleteModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    FileUpload,
    MoneyPipe,
    TPipe,
  ],
  templateUrl: './payment-manual-dialog.html',
  styleUrl: './payment-manual-dialog.scss',
})
export class PaymentManualDialog {
  readonly visible = model(false);
  readonly done = output<Payment>();

  private readonly auctions = inject(AuctionService);
  private readonly participants = inject(ParticipantService);
  private readonly payments = inject(PaymentService);
  private readonly documents = inject(DocumentService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly suggestions = signal<Auction[]>([]);
  protected readonly auction = signal<Auction | null>(null);
  protected readonly people = signal<Participant[]>([]);
  protected readonly participantId = signal<string | null>(null);
  protected readonly purpose = signal<'DEPOSIT' | 'FINAL_PAYMENT'>('DEPOSIT');
  protected readonly provider = signal<ManualPaymentInput['provider']>('CARD_TRANSFER');
  protected reference = '';
  protected note = '';
  protected readonly busy = signal(false);
  private file: File | null = null;

  protected readonly purposes = [
    { value: 'DEPOSIT', label: this.i18n.enumLabel('PaymentPurpose', 'DEPOSIT') },
    { value: 'FINAL_PAYMENT', label: this.i18n.enumLabel('PaymentPurpose', 'FINAL_PAYMENT') },
  ];
  protected readonly providers = (['CARD_TRANSFER', 'BANK_TRANSFER', 'MANUAL'] as const).map(
    (value) => ({ value, label: this.i18n.enumLabel('PaymentProvider', value) }),
  );

  protected readonly participant = computed(
    () => this.people().find((p) => p.id === this.participantId()) ?? null,
  );

  /** The amount the server expects: the deposit, or the price less the deposit already paid. */
  protected readonly expected = computed<number | null>(() => {
    const auction = this.auction();
    const participant = this.participant();
    if (!auction || !participant) return null;
    if (this.purpose() === 'DEPOSIT') return auction.depositAmount;
    const award = (auction.result?.awards ?? []).find(
      (a) => a.participantId === participant.id && a.status === 'ACCEPTED',
    );
    if (!award) return null;
    return participant.depositStatus === 'PAID' ? award.price - auction.depositAmount : award.price;
  });

  protected readonly noAward = computed(
    () => this.purpose() === 'FINAL_PAYMENT' && !!this.participant() && this.expected() === null,
  );

  protected readonly canSave = computed(
    () => !!this.participantId() && this.expected() !== null && !this.busy(),
  );

  protected opened(): void {
    this.auction.set(null);
    this.people.set([]);
    this.participantId.set(null);
    this.purpose.set('DEPOSIT');
    this.provider.set('CARD_TRANSFER');
    this.reference = '';
    this.note = '';
    this.file = null;
  }

  protected search(event: AutoCompleteCompleteEvent): void {
    this.auctions
      .list({ searchText: event.query, pageSize: 10, sortBy: 'CreatedAt', sortDirection: 'desc' })
      .subscribe({
        next: (page) => this.suggestions.set(page.items),
        error: () => this.suggestions.set([]),
      });
  }

  /** An auction was chosen: load it in full (its result holds the purchase offers) and its approved applicants. */
  protected chose(auction: Auction | null): void {
    this.auction.set(auction);
    this.people.set([]);
    this.participantId.set(null);
    if (!auction) return;
    this.auctions.get(auction.id).subscribe((full) => this.auction.set(full));
    this.participants
      .ofAuction(auction.id, {
        pageSize: 100,
        sortBy: 'ParticipantNumber',
        sortDirection: 'asc',
        filters: { 'status.equals': 'APPROVED' },
      })
      .subscribe((page) => this.people.set(page.items));
  }

  protected label(participant: Participant): string {
    return `№${participant.participantNumber} · ${participant.userFullName}`;
  }

  protected picked(files: File[]): void {
    this.file = files[0] ?? null;
  }

  protected save(): void {
    const amount = this.expected();
    const participantId = this.participantId();
    if (amount === null || !participantId || this.busy()) return;
    this.busy.set(true);
    this.payments
      .recordManual({
        participantId,
        purpose: this.purpose(),
        amount,
        provider: this.provider(),
        reference: this.reference,
        note: this.note,
      })
      .subscribe({
        next: (payment) => this.attachAndFinish(payment),
        error: (error: unknown) => {
          this.busy.set(false);
          this.notify.error(error);
        },
      });
  }

  private attachAndFinish(payment: Payment): void {
    const finish = () => {
      this.busy.set(false);
      this.visible.set(false);
      this.notify.success(this.i18n.t('payments.manualDone'));
      this.done.emit(payment);
    };
    if (!this.file) return finish();
    this.documents
      .upload(this.file, { purpose: 'PAYMENT_RECEIPT', paymentId: payment.id })
      .subscribe({
        next: finish,
        error: (error: unknown) => {
          // The payment is recorded; only the check did not attach: say so and let the staff attach it from the list.
          this.notify.error(error);
          finish();
        },
      });
  }
}
