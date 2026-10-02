# transports/bluetooth_socket.py
import socket
import sys
from .base import BaseTransport

class BluetoothSocketTransport(BaseTransport):
    name = "bluetooth"

    def __init__(self, config: dict):
        super().__init__(config)
        self.bt_config = config.get("bluetooth", {})
        self.mac = self.bt_config.get("mac", "86:67:7A:0D:B7:9A")
        self.channel = int(self.bt_config.get("channel", 1))

    def is_available(self) -> bool:
        # Verifica si socket soporta Bluetooth en esta plataforma
        return hasattr(socket, "AF_BLUETOOTH") and hasattr(socket, "BTPROTO_RFCOMM")

    def send(self, data: bytes) -> dict:
        if not self.is_available():
            raise RuntimeError("AF_BLUETOOTH no está soportado en este entorno.")
            
        s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
        s.settimeout(10.0) # 10s timeout
        try:
            target = (self.mac, self.channel)
            s.connect(target)
            total_sent = 0
            while total_sent < len(data):
                sent = s.send(data[total_sent:])
                if sent == 0:
                    raise RuntimeError("Conexión Bluetooth cerrada inesperadamente.")
                total_sent += sent
            return {
                "success": True,
                "transport": self.name,
                "bytes_sent": total_sent,
                "device": f"{self.mac}:{self.channel}"
            }
        finally:
            try:
                s.close()
            except Exception:
                pass

    def get_info(self) -> dict:
        info = super().get_info()
        info["mac"] = self.mac
        info["channel"] = self.channel
        return info
