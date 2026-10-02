# transports/manager.py
from .bluetooth_socket import BluetoothSocketTransport
from .usb_transport import UsbTransport
from .serial_transport import SerialTransport
from .mock_transport import MockTransport

class TransportManager:
    def __init__(self, config: dict):
        self.config = config
        self.transports = {
            "bluetooth": BluetoothSocketTransport(config),
            "usb": UsbTransport(config),
            "serial": SerialTransport(config),
            "mock": MockTransport(config)
        }

    def list_transports(self) -> list:
        return [t.get_info() for t in self.transports.values()]

    def resolve_transport(self, requested: str = None):
        req = (requested or self.config.get("default_transport", "auto")).lower()
        if req != "auto" and req in self.transports:
            return self.transports[req]

        # Orden de preferencia en modo AUTO:
        if self.transports["bluetooth"].is_available():
            return self.transports["bluetooth"]
        if self.transports["usb"].is_available():
            return self.transports["usb"]
        if self.transports["serial"].is_available():
            return self.transports["serial"]
        return self.transports["mock"]

    def send(self, data: bytes, requested_transport: str = None) -> dict:
        req = (requested_transport or self.config.get("default_transport", "auto")).lower()

        # Si se pidió un transporte específico
        if req != "auto" and req in self.transports:
            return self.transports[req].send(data)

        # Modo AUTO con cascada de hardware:
        # 1. Probar Bluetooth
        bt_error = None
        try:
            return self.transports["bluetooth"].send(data)
        except Exception as e:
            bt_error = e

        # 2. Probar USB
        usb_error = None
        if self.transports["usb"].is_available():
            try:
                return self.transports["usb"].send(data)
            except Exception as e:
                usb_error = e

        # 3. Probar Serial
        if self.transports["serial"].is_available():
            try:
                return self.transports["serial"].send(data)
            except Exception:
                pass

        # 4. Fallback al simulador de consola si falló el hardware
        print(f"[TransportManager] Hardware no disponible (BT: {bt_error}). Mostrando en simulador...")
        res = self.transports["mock"].send(data)
        res["warning"] = f"Fallo en bluetooth: {str(bt_error)}"
        return res
