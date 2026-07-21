import { TripStatus } from '@prisma/client';

/** SeeSight issuer details for trip invoices (payable by client companies). */
export const SEESIGHT_INVOICE_ISSUER = {
  name: 'SeeSight',
  legalName: 'SeeSight',
  bankIban: 'GE24TB7431145061100139',
  bankLabel: 'Bank transfer (IBAN)',
} as const;

export const INVOICEABLE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.APPROVED,
  TripStatus.IN_PROGRESS,
  TripStatus.COMPLETED,
];
