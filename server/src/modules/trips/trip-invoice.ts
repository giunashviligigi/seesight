import PDFDocument from 'pdfkit';
import { SEESIGHT_INVOICE_ISSUER } from './invoice.constants';

export type InvoiceLineItem = {
  description: string;
  amount: number;
  currency: string;
};

export type TripInvoiceModel = {
  invoiceNumber: string;
  invoiceDate: string;
  approvalDate: string | null;
  issuerName: string;
  issuerBankIban: string;
  billToName: string;
  billToCountry: string | null;
  billToBillingEmail: string | null;
  tripId: string;
  tripPurpose: string;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  tripStatus: string;
  travelers: string[];
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  currency: string;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function buildInvoiceNumber(tripId: string, invoiceDate: string): string {
  const short = tripId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  const day = invoiceDate.replace(/-/g, '');
  return `INV-${short}-${day}`;
}

/**
 * Build a PDF invoice buffer (SeeSight → registered company).
 */
export function renderTripInvoicePdf(model: TripInvoiceModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: model.invoiceNumber,
        Author: SEESIGHT_INVOICE_ISSUER.name,
        Subject: `Invoice for trip ${model.tripId}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('INVOICE', 50, y);
    y = doc.y + 8;

    doc.font('Helvetica-Bold').fontSize(11).text(model.invoiceNumber, 50, y);
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(`Invoice date: ${model.invoiceDate}`, 50, y);
    y = doc.y + 2;
    if (model.approvalDate) {
      doc.text(`Trip approved: ${model.approvalDate}`, 50, y);
      y = doc.y + 2;
    }
    y += 14;

    const colGap = 16;
    const colWidth = (pageWidth - colGap) / 2;
    const leftX = 50;
    const rightX = 50 + colWidth + colGap;
    const boxTop = y;
    const boxPad = 10;

    const drawPartyBox = (
      x: number,
      title: string,
      lines: string[],
    ): number => {
      let cursor = boxTop + boxPad;
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(title, x + boxPad, cursor, {
        width: colWidth - boxPad * 2,
      });
      cursor = doc.y + 6;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        if (i === 0) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
        } else {
          doc.font('Helvetica').fontSize(10).fillColor('#334155');
        }
        doc.text(line, x + boxPad, cursor, { width: colWidth - boxPad * 2 });
        cursor = doc.y + 3;
      }
      return cursor + boxPad;
    };

    const fromLines = [
      model.issuerName,
      SEESIGHT_INVOICE_ISSUER.bankLabel,
      model.issuerBankIban,
    ];
    const billLines = [
      model.billToName,
      model.billToCountry ?? '',
      model.billToBillingEmail ?? '',
    ].filter(Boolean);

    const leftBottom = drawPartyBox(leftX, 'FROM', fromLines);
    const rightBottom = drawPartyBox(rightX, 'BILL TO', billLines);
    const boxBottom = Math.max(leftBottom, rightBottom);

    doc.strokeColor('#cbd5e1').lineWidth(1);
    doc.rect(leftX, boxTop, colWidth, boxBottom - boxTop).stroke();
    doc.rect(rightX, boxTop, colWidth, boxBottom - boxTop).stroke();

    y = boxBottom + 20;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('TRIP', 50, y);
    y = doc.y + 6;
    doc.font('Helvetica-Bold').fontSize(11).text(model.tripPurpose, 50, y, {
      width: pageWidth,
    });
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(
      `${model.tripDestination}  ·  ${model.tripStartDate} → ${model.tripEndDate}  ·  status ${model.tripStatus.toLowerCase()}`,
      50,
      y,
      { width: pageWidth },
    );
    y = doc.y + 2;
    doc.text(`Trip ID: ${model.tripId}`, 50, y, { width: pageWidth });
    y = doc.y + 8;
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('TRAVELERS', 50, y);
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    if (model.travelers.length === 0) {
      doc.text('No travelers listed', 50, y);
      y = doc.y + 2;
    } else {
      for (const traveler of model.travelers) {
        doc.text(`• ${traveler}`, 50, y, { width: pageWidth });
        y = doc.y + 2;
      }
    }

    y += 14;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('CHARGES', 50, y);
    y = doc.y + 8;

    const amountColWidth = 110;
    const descColWidth = pageWidth - amountColWidth;

    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('DESCRIPTION', 50, y, { width: descColWidth });
    doc.text('AMOUNT', 50 + descColWidth, y, {
      width: amountColWidth,
      align: 'right',
    });
    y = doc.y + 4;
    doc
      .moveTo(50, y)
      .lineTo(50 + pageWidth, y)
      .strokeColor('#e2e8f0')
      .stroke();
    y += 8;

    if (model.lineItems.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b');
      doc.text('No selected flight or hotel offers on this trip.', 50, y, {
        width: pageWidth,
      });
      y = doc.y + 8;
    } else {
      for (const item of model.lineItems) {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        const rowTop = y;
        doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
        doc.text(item.description, 50, rowTop, { width: descColWidth - 8 });
        const afterDesc = doc.y;
        doc.text(formatMoney(item.amount, item.currency), 50 + descColWidth, rowTop, {
          width: amountColWidth,
          align: 'right',
        });
        y = Math.max(afterDesc, doc.y) + 8;
      }
    }

    doc
      .moveTo(50, y)
      .lineTo(50 + pageWidth, y)
      .strokeColor('#e2e8f0')
      .stroke();
    y += 12;

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a');
    doc.text(
      `Total due: ${formatMoney(model.totalAmount, model.currency)}`,
      50,
      y,
      { width: pageWidth, align: 'right' },
    );
    y = doc.y + 24;

    doc
      .moveTo(50, y)
      .lineTo(50 + pageWidth, y)
      .strokeColor('#e2e8f0')
      .stroke();
    y += 12;

    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text(
      `Please pay SeeSight via bank transfer to IBAN ${model.issuerBankIban}. Reference invoice ${model.invoiceNumber}.`,
      50,
      y,
      { width: pageWidth },
    );

    doc.end();
  });
}
