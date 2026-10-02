# transports/serial_transport.py
import os
import sys
from .base import BaseTransport

class SerialTransport(BaseTransport):
    name = "serial"

    def __init__(self, config: dict):
        super().__init__(config)
        serial_cfg = config.get("serial", {})
        default_port = "COM3" if sys.platform.startswith("win") else "/dev/rfcomm0"
        self.port = serial_cfg.get("port", default_port)
        self.baudrate = serial_cfg.get("baudrate", 9600)

    def is_available(self) -> bool:
        if sys.platform.startswith("win"):
            # En Windows los puertos COM se pueden verificar abriendo \\.\COMx
            port_name = self.port if self.port.startswith("\\\\.\\") else f"\\\\.\\{self.port}"
            try:
                with open(port_name, "wb", buffering=0) as _:
                    return True
            except Exception:
                return False
        else:
            return os.path.exists(self.port) and os.access(self.port, os.W_OK)

    def send(self, data: bytes) -> dict:
        port_name = self.port
        if sys.platform.startswith("win") and not port_name.startswith("\\\\.\\"):
            port_name = f"\\\\.\\{port_name}"

        # Intentar con pyserial si estuviera disponible, o escritura directa
        try:
            import serial
            with serial.Serial(self.port, self.baudrate, timeout=5) as ser:
                ser.write(data)
        except ImportError:
            # Fallback a escritura directa en archivo de dispositivo
            with open(port_name, "wb", buffering=0) as f:
                f.write(data)

        return {
            "success": True,
            "transport": self.name,
            "bytes_sent": len(data),
            "port": self.port
        }

    def get_info(self) -> dict:
        info = super().get_info()
        info["port"] = self.port
        info["baudrate"] = self.baudrate
        return info
