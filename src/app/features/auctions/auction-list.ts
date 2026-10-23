import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { DataTable, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Auction, AuctionService } from './auction.service';

@Component({
  selector: 'app-auction-list',
  imports: [
    RouterLink,
    ButtonModule,
    DataTable,
    FilterBar,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './auction-list.html',
})
export class AuctionList {
  private readonly auctions = inject(AuctionService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly filters = signal<FilterValues>({});

  protected readonly fields: FilterField[] = [
    {
      key: 'status',
      label: this.i18n.t('auctions.status'),
      type: 'select',
      options: this.i18n.enumOptions('AuctionStatus'),
    },
    { key: 'startsAt', label: this.i18n.t('auctions.startsAt'), type: 'date-range' },
  ];

  protected readonly columns: TableColumn<Auction>[] = [
    { field: 'lotNumber', header: this.i18n.t('auctions.lot') },
    { field: 'title', header: this.i18n.t('auctions.titleField') },
    {
      field: 'status',
      header: this.i18n.t('auctions.status'),
      type: 'enum',
      enumName: 'AuctionStatus',
    },
    {
      field: 'startingPrice',
      header: this.i18n.t('auctions.startingPrice'),
      type: 'money',
      align: 'right',
    },
    {
      field: 'currentPrice',
      header: this.i18n.t('auctions.currentPrice'),
      type: 'money',
      align: 'right',
    },
    { field: 'startsAt', header: this.i18n.t('auctions.startsAt'), type: 'datetime' },
    { field: 'endsAt', header: this.i18n.t('auctions.endsAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) => this.auctions.list(query);

  protected open(auction: Auction): void {
    void this.router.navigate(['/auctions', auction.id]);
  }
}
