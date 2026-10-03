// transports/serialTransport.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

export class SerialTransport {
  name = 'serial';

  constructor(config = {}) {
    this.config = config;
    const isWin = os.platform() === 'win32';
    const serialCfg = config.serial || {};
    this.port = serialCfg.port || 'auto';
    this.baudrate = serialCfg.baudrate || 9600;
    this._detectedPort = null;
  }

  _detectWindowsBluetoothPort() {
    try {
      const raw = execSync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\BTHENUM" /s /f "PortName"', {
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 2000
      }).toString();

      const targetMac = (this.config.bluetooth?.mac || '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
      const blocks = raw.split(/\r?\n\r?\n/);

      let matchedPort = null;
      let fallbackOutbound = null;

      for (const block of blocks) {
        const match = block.match(/PortName\s+REG_SZ\s+(COM\d+)/i);
        if (!match) continue;
        const portName = match[1].toUpperCase();
        const isOutbound = !block.includes('000000000000');

        if (isOutbound) {
          if (!fallbackOutbound) fallbackOutbound = portName;
          if (targetMac && block.toUpperCase().includes(targetMac)) {
            matchedPort = portName;
            break;
          }
        }
      }

      if (matchedPort || fallbackOutbound) {
        return matchedPort || fallbackOutbound;
      }
    } catch {}

    try {
      const commRaw = execSync('reg query "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"', {
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      }).toString();
      const matches = [...commRaw.matchAll(/REG_SZ\s+(COM\d+)/gi)];
      if (matches.length > 0) {
        return matches[matches.length - 1][1].toUpperCase();
      }
    } catch {}

    return null;
  }

  _getDevicePath() {
    if (os.platform() === 'win32') {
      const rawPort = (this.port || 'auto').replace(/^\\\\\.\\/, '');
      if (rawPort.toLowerCase() === 'auto') {
        if (!this._detectedPort) {
          this._detectedPort = this._detectWindowsBluetoothPort();
          if (this._detectedPort) {
            console.log(`[SerialTransport] 🔍 Puerto Bluetooth autodetectado en Windows: ${this._detectedPort}`);
          }
        }
        return this._detectedPort || 'COM4';
      }
      return rawPort;
    }
    if (this.port && this.port.toLowerCase() !== 'auto' && fs.existsSync(this.port)) return this.port;
    if (fs.existsSync('/dev/rfcomm0')) return '/dev/rfcomm0';
    if (fs.existsSync('/dev/rfcomm1')) return '/dev/rfcomm1';
    return this.port || '/dev/rfcomm0';
  }

  isAvailable() {
    const devPath = this._getDevicePath();
    try {
      if (os.platform() === 'win32') {
        try {
          const out = execSync('reg query "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM"', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 1000 }).toString();
          return out.toUpperCase().includes(devPath.toUpperCase());
        } catch {
          return true;
        }
      }
      return fs.existsSync(devPath) && fs.statSync(devPath).isCharacterDevice();
    } catch {
      return false;
    }
  }

  async send(buffer) {
    const devPath = this._getDevicePath();

    if (os.platform() === 'win32') {
      // En Windows, escribir a dispositivos de caracteres (COM) vía fs.openSync falla en libuv con ENOENT/UNKNOWN.
      // Usamos el comando binario nativo 'copy /b' hacia el puerto COM.
      const tmpFile = path.join(os.tmpdir(), `print_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
      try {
        fs.writeFileSync(tmpFile, buffer);
        execSync(`cmd.exe /c "copy /b "${tmpFile}" ${devPath}"`, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000
        });
        // Dar tiempo al transmisor de radio Bluetooth para vaciar paquetes
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          success: true,
          transport: this.name,
          device: devPath,
          bytes_sent: buffer.length
        };
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    if (os.platform() === 'linux') {
      try {
        execSync(`stty -F ${devPath} ${this.baudrate} raw -echo 2>/dev/null`, { timeout: 1500 });
      } catch {}
    }

    let fd;
    try {
      const flags = fs.constants.O_WRONLY | fs.constants.O_NONBLOCK;
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
