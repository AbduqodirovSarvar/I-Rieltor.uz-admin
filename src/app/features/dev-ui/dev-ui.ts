import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Row {
  lot: string;
  title: string;
  status: string;
}

/** Component gallery for checking the theme and the PrimeNG setup (dev only, not linked from the menu). */
@Component({
  selector: 'app-dev-ui',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ToastModule,
  ],
  template: `
    <p-toast />
    <h1>UI namunalari</h1>
    <div class="row">
      <input pInputText placeholder="Qidiruv" [(ngModel)]="search" aria-label="Qidiruv" />
      <p-select [options]="statuses" [(ngModel)]="status" placeholder="Holat" aria-label="Holat" />
      <p-button label="Saqlash" icon="pi pi-check" (onClick)="save()" />
      <p-button label="Dialog" severity="secondary" (onClick)="dialog.set(true)" />
    </div>
    <p-table [value]="rows" styleClass="mt">
      <ng-template #header>
        <tr>
          <th>Lot</th>
          <th>Nomi</th>
          <th>Holat</th>
        </tr>
      </ng-template>
      <ng-template #body let-row>
        <tr>
          <td>{{ row.lot }}</td>
          <td>{{ row.title }}</td>
          <td>{{ row.status }}</td>
        </tr>
      </ng-template>
    </p-table>
    <p-dialog header="Tasdiqlash" [(visible)]="dialogOpen" [modal]="true">
      <p>Dialog matni</p>
    </p-dialog>
  `,
  styles: `
    :host {
      display: block;
      padding: 1.5rem;
    }
    .row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
  `,
})
export class DevUi {
  private readonly messages = inject(MessageService);
  protected search = '';
  protected status: string | null = null;
  protected readonly statuses = ['DRAFT', 'SCHEDULED', 'ONGOING'];
  protected readonly dialog = signal(false);
  protected rows: Row[] = [
    { lot: '2026-000001', title: 'Toshkent, 3 xonali kvartira', status: 'SCHEDULED' },
    { lot: '2026-000002', title: 'Chilonzor, yer uchastkasi', status: 'ONGOING' },
  ];

  protected get dialogOpen(): boolean {
    return this.dialog();
  }
  protected set dialogOpen(value: boolean) {
    this.dialog.set(value);
  }

  protected save(): void {
    this.messages.add({ severity: 'success', summary: 'Saqlandi', detail: 'Namuna xabar' });
  }
}
