import type { components } from './schema';

/** Short names for the generated schemas (`npm run api:types`): `Schema<'AuctionViewModel'>` or the aliases below. */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

export type UserView = Schema<'UserViewModel'>;
export type TokenView = Schema<'TokenViewModel'>;
