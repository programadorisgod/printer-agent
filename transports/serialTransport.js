// transports/serialTransport.js
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

export class SerialTransport {
  name = 'serial';

  constructor(config = {}) {
    this.config = config;
    const isWin = os.platform() === 'win32';
    const serialCfg = config.serial || {};
    this.port = serialCfg.port || (isWin ? 'COM3' : '/dev/rfcomm0');
    this.baudrate = serialCfg.baudrate || 9600;
  }

  _getDevicePath() {
    if (os.platform() === 'win32') {
      return this.port.startsWith('\\\\.\\') ? this.port : `\\\\.\\${this.port}`;
    }
    if (fs.existsSync(this.port)) return this.port;
    if (fs.existsSync('/dev/rfcomm0')) return '/dev/rfcomm0';
    if (fs.existsSync('/dev/rfcomm1')) return '/dev/rfcomm1';
    return this.port;
  }

  isAvailable() {
    const devPath = this._getDevicePath();
    try {
      if (os.platform() === 'win32') {
        const fd = fs.openSync(devPath, fs.constants.O_RDWR);
        fs.closeSync(fd);
        return true;
      }
      return fs.existsSync(devPath) && fs.statSync(devPath).isCharacterDevice();
    } catch {
      return false;
    }
  }

  async send(buffer) {
    const devPath = this._getDevicePath();

    if (os.platform() === 'linux') {
      try {
        execSync(`stty -F ${devPath} ${this.baudrate} raw -echo 2>/dev/null`, { timeout: 1500 });
      } catch {}
    }

    let fd;
    try {
      // O_NONBLOCK evita que el hilo de Node.js se congele en tty_port_block_til_ready
      const flags = os.platform() === 'win32'
        ? fs.constants.O_WRONLY
        : (fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
      
      fd = fs.openSync(devPath, flags);
      fs.writeSync(fd, buffer, 0, buffer.length);
      
      // Permitir que el transmisor Bluetooth vacíe los paquetes antes de cerrar
      await new Promise(resolve => setTimeout(resolve, 1500));
      return {
        success: true,
        transport: this.name,
        device: devPath,
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
      port: this._getDevicePath(),
      baudrate: this.baudrate
    };
  }
}
