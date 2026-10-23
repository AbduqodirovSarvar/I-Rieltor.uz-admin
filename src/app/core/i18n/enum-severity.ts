import { EnumName } from './i18n.service';

export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/** The colour of a status badge, per enum and value. Values not listed are neutral. */
const severities: Partial<Record<EnumName, Record<string, Severity>>> = {
  AuctionStatus: {
    DRAFT: 'secondary',
    SCHEDULED: 'info',
    ONGOING: 'success',
    FINISHED: 'contrast',
    FAILED: 'warn',
    CANCELLED: 'danger',
  },
  PropertyStatus: {
    DRAFT: 'secondary',
    PUBLISHED: 'info',
    IN_AUCTION: 'success',
    SOLD: 'contrast',
    ARCHIVED: 'secondary',
  },
  ParticipantStatus: {
    PENDING: 'warn',
    APPROVED: 'success',
    REJECTED: 'danger',
    WITHDRAWN: 'secondary',
  },
  DepositStatus: { NOT_PAID: 'warn', PAID: 'success', REFUNDED: 'info', FORFEITED: 'danger' },
  PaymentStatus: {
    PENDING: 'warn',
    PAID: 'success',
    FAILED: 'danger',
    CANCELLED: 'secondary',
    REFUNDED: 'info',
  },
  AuctionOutcome: {
    AWAITING_PAYMENT: 'warn',
    AWAITING_RUNNER_UP: 'warn',
    SOLD: 'success',
    NOT_SOLD: 'danger',
    NO_PARTICIPANTS: 'secondary',
    NO_BIDS: 'secondary',
  },
  AwardStatus: {
    OFFERED: 'info',
    ACCEPTED: 'warn',
    PAID: 'success',
    DECLINED: 'secondary',
    DEFAULTED: 'danger',
    EXPIRED: 'secondary',
  },
  ClientType: { NONE: 'secondary', INDIVIDUAL: 'info', LEGAL: 'contrast' },
  NotificationStatus: { PENDING: 'warn', SENT: 'success', FAILED: 'danger', SKIPPED: 'secondary' },
};

export function enumSeverity(name: EnumName, value: string | null | undefined): Severity {
  return (value && severities[name]?.[value]) || 'secondary';
}
