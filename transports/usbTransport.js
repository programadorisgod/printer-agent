// transports/usbTransport.js
import fs from 'node:fs';
import os from 'node:os';

export class UsbTransport {
  name = 'usb';

  constructor(config = {}) {
    this.config = config;
    this.devicePath = config.usb?.device_path || '/dev/usb/lp0';
  }

  _resolveDevice() {
    if (os.platform() === 'linux') {
      if (fs.existsSync(this.devicePath)) return this.devicePath;
      for (let i = 0; i < 5; i++) {
        const candidate = `/dev/usb/lp${i}`;
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    return this.devicePath;
  }

  isAvailable() {
    const dev = this._resolveDevice();
    try {
      return fs.existsSync(dev) && (fs.accessSync(dev, fs.constants.W_OK) === undefined);
    } catch {
      return false;
    }
  }

  async send(buffer) {
    const dev = this._resolveDevice();
    let fd;
    try {
      fd = fs.openSync(dev, 'w');
      fs.writeSync(fd, buffer, 0, buffer.length);
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        transport: this.name,
        device: dev,
        bytes_sent: buffer.length
      };
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
    }
  }

  getInfo() {
    return {
      name: this.name,
      available: this.isAvailable(),
      device: this._resolveDevice()
    };
  }
}
