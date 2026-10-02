// transports/manager.js
import { SerialTransport } from './serialTransport.js';
import { UsbTransport } from './usbTransport.js';
import { MockTransport } from './mockTransport.js';

export class TransportManager {
  constructor(config = {}) {
    this.config = config;
    this.transports = {
      serial: new SerialTransport(config),
      usb: new UsbTransport(config),
      mock: new MockTransport()
    };
  }

  listTransports() {
    return Object.values(this.transports).map(t => t.getInfo());
  }

  resolveTransport(requested) {
    const req = (requested || this.config.default_transport || 'auto').toLowerCase();
    if (req !== 'auto' && this.transports[req]) {
      return this.transports[req];
    }

    if (this.transports.serial.isAvailable()) return this.transports.serial;
    if (this.transports.usb.isAvailable()) return this.transports.usb;
    return this.transports.mock;
  }

  async send(buffer, requested) {
    const req = (requested || this.config.default_transport || 'auto').toLowerCase();

    if (req !== 'auto' && this.transports[req]) {
      return await this.transports[req].send(buffer);
    }

    // Modo AUTO
    // 1. Probar Serial / COM (/dev/rfcomm0 o COM3)
    if (this.transports.serial.isAvailable()) {
      try {
        return await this.transports.serial.send(buffer);
      } catch (err) {
        console.warn(`[TransportManager] Fallo en Serial: ${err.message}. Probando USB...`);
      }
    }

    // 2. Probar USB
    if (this.transports.usb.isAvailable()) {
      try {
        return await this.transports.usb.send(buffer);
      } catch (err) {
        console.warn(`[TransportManager] Fallo en USB: ${err.message}.`);
      }
    }

    // 3. Fallback a Simulador
    console.log('[TransportManager] Ningún hardware disponible. Renderizando en consola...');
    const res = await this.transports.mock.send(buffer);
    res.warning = 'Hardware no respondió; salida simulada en terminal.';
    return res;
  }
}
