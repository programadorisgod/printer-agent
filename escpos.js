// escpos.js - Formateador ESC/POS para papel de 58mm (32 columnas) con CRLF

const INIT = Buffer.from([0x1B, 0x40]);
const ALIGN_LEFT = Buffer.from([0x1B, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([0x1B, 0x61, 0x01]);
const ALIGN_RIGHT = Buffer.from([0x1B, 0x61, 0x02]);

const BOLD_ON = Buffer.from([0x1B, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1B, 0x45, 0x00]);

const TEXT_NORMAL = Buffer.from([0x1D, 0x21, 0x00]);
const TEXT_DOUBLE_HEIGHT = Buffer.from([0x1D, 0x21, 0x01]);
const TEXT_DOUBLE = Buffer.from([0x1D, 0x21, 0x11]);

const FEED_5 = Buffer.from([0x1B, 0x64, 0x05]);
const EOL = '\r\n'; // Imprescindible para impresoras térmicas seriales/Bluetooth

const LINE_WIDTH = 32;

function formatRow(left = '', right = '', width = LINE_WIDTH) {
  left = String(left);
  right = String(right);
  let spaceNeeded = width - left.length - right.length;
  if (spaceNeeded < 1) {
    left = left.substring(0, Math.max(0, width - right.length - 1));
    spaceNeeded = 1;
  }
  return left + ' '.repeat(spaceNeeded) + right;
}

function latin1(str) {
  return Buffer.from(str, 'latin1');
}

export function buildReceipt(ticket = {}) {
  const parts = [];

  // 1. Inicializar
  parts.push(INIT);

  // 2. Encabezado centrado
  parts.push(ALIGN_CENTER);
  parts.push(TEXT_DOUBLE);
  const storeName = ticket.store_name || 'MINI SHOP';
  parts.push(latin1(storeName + EOL));

  parts.push(TEXT_NORMAL);
  parts.push(BOLD_OFF);

  if (ticket.address) parts.push(latin1(ticket.address + EOL));
  if (ticket.phone) parts.push(latin1('Tel: ' + ticket.phone + EOL));

  const invoiceNo = ticket.invoice_no || 'TICKET #001';
  parts.push(latin1(invoiceNo + EOL));
  if (ticket.date) parts.push(latin1(ticket.date + EOL));

  // Separador
  parts.push(ALIGN_LEFT);
  parts.push(latin1('-'.repeat(LINE_WIDTH) + EOL));

  // 3. Cabecera de columnas
  parts.push(BOLD_ON);
  parts.push(latin1(formatRow('DESCRIPCION', 'TOTAL') + EOL));
  parts.push(BOLD_OFF);
  parts.push(latin1('-'.repeat(LINE_WIDTH) + EOL));

  // 4. Items
  const items = ticket.items || [];
  for (const it of items) {
    const qty = it.qty || 1;
    const name = it.name || 'Producto';
    const total = it.total || it.price || '$0';
    const itemLabel = `${qty}x ${name}`;
    parts.push(latin1(formatRow(itemLabel, String(total)) + EOL));
  }

  parts.push(latin1('-'.repeat(LINE_WIDTH) + EOL));

  // 5. Totales
  if (ticket.subtotal) {
    parts.push(latin1(formatRow('Subtotal:', String(ticket.subtotal)) + EOL));
  }
  if (ticket.tax) {
    parts.push(latin1(formatRow('IVA / Imp:', String(ticket.tax)) + EOL));
  }

  const totalVal = ticket.total || '$0';
  parts.push(BOLD_ON);
  parts.push(TEXT_DOUBLE_HEIGHT);
  parts.push(latin1(formatRow('TOTAL:', String(totalVal)) + EOL));
  parts.push(TEXT_NORMAL);
  parts.push(BOLD_OFF);

  parts.push(latin1('='.repeat(LINE_WIDTH) + EOL));

  // 6. Pie de página centrado
  parts.push(ALIGN_CENTER);
  const footer = ticket.footer || '¡Gracias por su compra!\n*** Prototipo PWA ***';
  for (const line of footer.split('\n')) {
    parts.push(latin1(line + EOL));
  }

  // 7. Avance para rasgar el ticket
  parts.push(FEED_5);
  parts.push(latin1(EOL + EOL));

  return Buffer.concat(parts);
}

export function buildRaw(text = '') {
  return Buffer.concat([
    INIT,
    ALIGN_LEFT,
    TEXT_NORMAL,
    latin1(text.replace(/\r?\n/g, EOL)),
    FEED_5,
    latin1(EOL)
  ]);
}
