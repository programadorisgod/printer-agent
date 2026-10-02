# transports/base.py

class BaseTransport:
    name = "base"
    
    def __init__(self, config: dict):
        self.config = config

    def is_available(self) -> bool:
        """Determina si este transporte está disponible en el sistema operativo."""
        raise NotImplementedError

    def send(self, data: bytes) -> dict:
        """Envía los bytes a la impresora."""
        raise NotImplementedError

    def get_info(self) -> dict:
        return {
            "name": self.name,
            "available": self.is_available()
        }
