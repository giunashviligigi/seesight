import {
  buildInvoiceNumber,
  renderTripInvoicePdf,
} from './trip-invoice';

describe('trip invoice helpers', () => {
  it('builds a stable invoice number', () => {
    expect(buildInvoiceNumber('clxyz12345678abcd', '2026-07-21')).toBe(
      'INV-5678ABCD-20260721',
    );
  });

  it('renders a PDF with issuer bank and bill-to company', async () => {
    const pdf = await renderTripInvoicePdf({
      invoiceNumber: 'INV-TEST-20260721',
      invoiceDate: '2026-07-21',
      approvalDate: '2026-07-20',
      issuerName: 'SeeSight',
      issuerBankIban: 'GE24TB7431145061100139',
      billToName: 'Acme Travel LLC',
      billToCountry: 'GE',
      billToBillingEmail: 'billing@acme.test',
      tripId: 'trip_1',
      tripPurpose: 'Client workshop',
      tripDestination: 'Berlin, DE',
      tripStartDate: '2026-08-01',
      tripEndDate: '2026-08-05',
      tripStatus: 'APPROVED',
      travelers: ['Ada Lovelace (primary)'],
      lineItems: [
        {
          description: 'Flight · TBS→BER',
          amount: 320,
          currency: 'EUR',
        },
      ],
      totalAmount: 320,
      currency: 'EUR',
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
