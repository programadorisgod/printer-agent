// server.js - Printer Agent en Node.js (Zero Dependencias) con soporte de Estampitas (TSPL) y Recibos (ESC/POS)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { TransportManager } from './transports/manager.js';
import { buildReceipt, buildRaw } from './escpos.js';
import { buildTsplReceipt } from './tspl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.warn('[Aviso] No se pudo parsear config.json:', err.message);
  }
}

const transportManager = new TransportManager(config);

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function sendJson(res, statusCode, data) {
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  sendCors(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/status' || url.pathname === '/print')) {
    const active = transportManager.resolveTransport();
    sendJson(res, 200, {
      status: 'online',
      service: 'Printer Agent (Node.js)',
      platform: os.platform(),
      mode: 'label (estampitas TSPL)',
      active_transport: active.name,
      transports: transportManager.listTransports(),
      message: url.pathname === '/print' ? 'Endpoint /print activo. Para imprimir, envía una petición POST con los datos del ticket.' : undefined,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === 'POST') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      let payload = {};
      try {
        payload = bodyData ? JSON.parse(bodyData) : {};
      } catch (err) {
        sendJson(res, 400, { error: 'JSON inválido en el cuerpo de la petición' });
        return;
      }

      const requestedTransport = payload.transport;
      const isReceipt = payload.mode === 'receipt';

      if (url.pathname === '/print') {
        try {
          let buffer;
          if (payload.ticket) {
            buffer = isReceipt ? buildReceipt(payload.ticket) : buildTsplReceipt(payload.ticket);
          } else if (payload.raw_text) {
            buffer = buildRaw(payload.raw_text);
          } else {
            sendJson(res, 400, { error: "Se requiere campo 'ticket' o 'raw_text'" });
            return;
          }

          const result = await transportManager.send(buffer, requestedTransport);
          sendJson(res, 200, {
            status: 'success',
            message: isReceipt ? 'Factura en papel continuo impresa' : 'Estampita impresa con éxito',
            mode: isReceipt ? 'receipt (ESC/POS)' : 'label (TSPL)',
            result
          });
        } catch (err) {
          sendJson(res, 500, {
            status: 'error',
            message: `Error al imprimir: ${err.message}`
          });
        }
        return;
      }

      if (url.pathname === '/test') {
        try {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const sampleTicket = {
            store_name: 'TIENDA EXPRESS',
            invoice_no: 'FAC-001',
            date: nowStr,
            items: [
              { qty: 2, name: 'Cafe Col.', price: '$3.000', total: '$6.000' },
              { qty: 1, name: 'Pastel Pollo', price: '$4.500', total: '$4.500' }
            ],
            subtotal: '$10.500',
            total: '$10.500',
            footer: '¡Gracias por su compra!\n*** Factura PWA ***'
          };
          const buffer = isReceipt ? buildReceipt(sampleTicket) : buildTsplReceipt(sampleTicket);
          const result = await transportManager.send(buffer, requestedTransport);
          sendJson(res, 200, {
            status: 'success',
            message: isReceipt ? 'Ticket de prueba en papel continuo impreso' : 'Estampita de prueba impresa',
            mode: isReceipt ? 'receipt (ESC/POS)' : 'label (TSPL)',
            result
          });
        } catch (err) {
          sendJson(res, 500, {
            status: 'error',
            message: `Error en test: ${err.message}`
          });
        }
        return;
      }

      sendJson(res, 404, { error: 'Ruta POST no encontrada', path: url.pathname });
    });
    return;
  }

  sendJson(res, 404, { error: 'Ruta no encontrada', path: url.pathname });
});

const port = Number(config.port || 3333);
const host = config.host || '0.0.0.0';

server.listen(port, host, () => {
  console.log('==================================================');
  console.log(` 🖨️  Printer Agent (Node.js) - Modo Estampita TSPL`);
  console.log(` 📡 Servidor escuchando en: http://${host}:${port}`);
  console.log(` 💻 Sistema: ${os.platform()} (${os.arch()})`);
  const active = transportManager.resolveTransport();
  console.log(` 🚀 Transporte activo: ${active.name}`);
  console.log('==================================================');
});
