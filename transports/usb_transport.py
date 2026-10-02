# transports/usb_transport.py
import os
import glob
import sys
from .base import BaseTransport

class UsbTransport(BaseTransport):
    name = "usb"

    def __init__(self, config: dict):
        super().__init__(config)
        self.device_path = config.get("usb", {}).get("device_path", "/dev/usb/lp0")

    def _resolve_device(self) -> str:
        if sys.platform.startswith("linux"):
            if os.path.exists(self.device_path):
                return self.device_path
            # Buscar cualquier lp disponible
            devices = glob.glob("/dev/usb/lp*")
            if devices:
                return devices[0]
        elif sys.platform.startswith("win"):
            # En windows puede ser LPT1 o puerto de impresora USB
            return self.device_path
        return None

    def is_available(self) -> bool:
        dev = self._resolve_device()
        if dev and os.path.exists(dev):
            return os.access(dev, os.W_OK)
        return False

    def send(self, data: bytes) -> dict:
        dev = self._resolve_device()
        if not dev or not os.path.exists(dev):
            raise FileNotFoundError(f"Dispositivo USB no encontrado: {self.device_path}")
        
        with open(dev, "wb", buffering=0) as f:
            f.write(data)
            
        return {
            "success": True,
            "transport": self.name,
            "bytes_sent": len(data),
            "device": dev
        }

    def get_info(self) -> dict:
        info = super().get_info()
        info["device"] = self._resolve_device() or self.device_path
        return info
