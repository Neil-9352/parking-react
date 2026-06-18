const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const receiptsDir = path.join(__dirname, '../../receipts');

function ensureReceiptsDir() {
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }
}

async function generateReceipt(data) {
  ensureReceiptsDir();

  const safePlate = (data.plate || 'UNKNOWN').replace(/[^A-Z0-9_-]/g, '_');
  const fileName = `receipt_${safePlate}_${Date.now()}.pdf`;
  const filePath = path.join(receiptsDir, fileName);
  const relativePath = `receipts/${fileName}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Parking Receipt', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.8);

    // Details
    doc.fontSize(12).font('Helvetica');
    const line = (label, value) => {
      doc.font('Helvetica-Bold').text(label, { continued: true });
      doc.font('Helvetica').text(` ${value}`);
    };

    line('Vehicle Registration No:', data.plate || '—');
    line('Vehicle Type:', data.vehicleType || '—');
    line('In Time:', data.inTime || '—');
    line('Out Time:', data.outTime || '—');
    line('Minutes Parked:', String(data.minutesParked || 0));
    line('Hours Parked (rounded):', String(data.hoursParked || 1));
    line('First Hour Charge:', `Rs. ${parseFloat(data.firstHourCharge || 0).toFixed(2)}`);
    line('Subsequent Hour Charge:', `Rs. ${parseFloat(data.restHourCharge || 0).toFixed(2)}`);

    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica-Bold');
    line('Total Fee:', `Rs. ${parseFloat(data.parkingFee || 0).toFixed(2)}`);

    if (data.bookingId) {
      doc.moveDown(0.8);
      doc.fontSize(12).font('Helvetica-Bold').text('--- Booking Details ---', { align: 'center' });
      doc.font('Helvetica');
      line('Booking ID:', `#${data.bookingId}`);
      line('Deposit Paid:', `Rs. ${parseFloat(data.bookingAmount || 0).toFixed(2)}`);
      line('Deposit Refund:', data.refundStatus || 'N/A');
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('gray').text('Thank you for using our parking service.', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve({ fileName, relativePath }));
    stream.on('error', reject);
  });
}

module.exports = { generateReceipt };
