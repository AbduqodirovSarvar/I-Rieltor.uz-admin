import { TextKey } from '../i18n/i18n.service';

export interface NavItem {
  label: TextKey;
  icon: string;
  route: string;
  /** The user needs at least one of these permissions to see the item. Empty: everybody who is signed in. */
  permissions: readonly string[];
  /** False until the page exists; the item is hidden meanwhile. */
  ready: boolean;
}

export interface NavGroup {
  label: TextKey;
  items: readonly NavItem[];
}

/** The menu. Flip `ready` when a section's pages are built. */
export const NAV: readonly NavGroup[] = [
  {
    label: 'nav.groupMain',
    items: [
      { label: 'nav.dashboard', icon: 'pi pi-home', route: '/', permissions: [], ready: true },
    ],
  },
  {
    label: 'nav.groupDeals',
    items: [
      {
        label: 'nav.auctions',
        icon: 'pi pi-megaphone',
        route: '/auctions',
        permissions: ['READ_AUCTION'],
        ready: false,
      },
      {
        label: 'nav.participants',
        icon: 'pi pi-users',
        route: '/participants',
        permissions: ['READ_AUCTIONPARTICIPANT'],
        ready: false,
      },
      {
        label: 'nav.payments',
        icon: 'pi pi-wallet',
        route: '/payments',
        permissions: ['READ_PAYMENT'],
        ready: false,
      },
      {
        label: 'nav.documents',
        icon: 'pi pi-file',
        route: '/documents',
        permissions: ['READ_PRIVATEDOCUMENT'],
        ready: false,
      },
    ],
  },
  {
    label: 'nav.groupCatalog',
    items: [
      {
        label: 'nav.properties',
        icon: 'pi pi-building',
        route: '/properties',
        permissions: ['READ_PROPERTY'],
        ready: false,
      },
      {
        label: 'nav.categories',
        icon: 'pi pi-sitemap',
        route: '/categories',
        permissions: ['READ_PROPERTYCATEGORY'],
        ready: false,
      },
    ],
  },
  {
    label: 'nav.groupContent',
    items: [
      {
        label: 'nav.slides',
        icon: 'pi pi-images',
        route: '/slides',
        permissions: ['READ_SLIDE'],
        ready: false,
      },
      {
        label: 'nav.company',
        icon: 'pi pi-briefcase',
        route: '/company',
        permissions: ['READ_COMPANY'],
        ready: false,
      },
    ],
  },
  {
    label: 'nav.groupAdmin',
    items: [
      {
        label: 'nav.users',
        icon: 'pi pi-user',
        route: '/users',
        permissions: ['READ_USER'],
        ready: false,
      },
      {
        label: 'nav.roles',
        icon: 'pi pi-shield',
        route: '/roles',
        permissions: ['READ_USERROLE'],
        ready: false,
      },
    ],
  },
  {
    label: 'nav.groupControl',
    items: [
      {
        label: 'nav.audit',
        icon: 'pi pi-history',
        route: '/audit',
        permissions: ['READ_AUDITLOG'],
        ready: false,
      },
      {
        label: 'nav.notifications',
        icon: 'pi pi-bell',
        route: '/notifications',
        permissions: ['READ_NOTIFICATION'],
        ready: false,
      },
    ],
  },
];
