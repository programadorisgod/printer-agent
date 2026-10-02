// tspl.js - Formateador de Mini Facturas para papel de estampitas / etiquetas (TSPL)

export function buildTsplReceipt(ticket = {}, options = {}) {
  const widthMm = options.widthMm || 50;
  const heightMm = options.heightMm || 40;
  const gapMm = options.gapMm || 2;

  const commands = [];
  commands.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
  commands.push(`GAP ${gapMm} mm, 0`);
  commands.push(`DIRECTION 0`);
  commands.push(`CLS`);

  let y = 15;

  // 1. Título / Nombre de la Tienda
  const storeName = (ticket.store_name || 'MINI SHOP').substring(0, 20);
  commands.push(`TEXT 15,${y},"3",0,1,1,"${storeName}"`);
  y += 28;

  // 2. Número de Factura y Fecha
  const invoiceNo = ticket.invoice_no || 'TICKET #001';
  const dateStr = ticket.date || '';
  commands.push(`TEXT 15,${y},"2",0,1,1,"${invoiceNo}  ${dateStr}"`);
  y += 22;

  // 3. Línea divisoria
  commands.push(`BAR 15,${y},350,2`);
  y += 8;

  // 4. Ítems (hasta 3-4 ítems para que quepa en la estampita)
  const items = ticket.items || [];
  for (const it of items.slice(0, 4)) {
    const qty = it.qty || 1;
    const name = (it.name || 'Prod').substring(0, 14);
    const price = String(it.total || it.price || '$0');
    
    commands.push(`TEXT 15,${y},"2",0,1,1,"${qty}x ${name}"`);
    commands.push(`TEXT 260,${y},"2",0,1,1,"${price}"`);
    y += 22;
  }

  // 5. Línea divisoria
  commands.push(`BAR 15,${y},350,2`);
  y += 8;

  // 6. Total Destacado
  const total = ticket.total || '$0';
  commands.push(`TEXT 15,${y},"3",0,1,1,"TOTAL: ${total}"`);
  y += 28;

  // 7. Mini pie de página
  commands.push(`TEXT 15,${y},"1",0,1,1,"* Gracias por su compra * PWA *"`);

  // 8. Imprimir 1 copia
  commands.push(`PRINT 1,1`);
  commands.push(``);

  return Buffer.from(commands.join('\r\n'), 'latin1');
}
