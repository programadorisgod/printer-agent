# transports/mock_transport.py
import re
from .base import BaseTransport

class MockTransport(BaseTransport):
    name = "mock"

    def is_available(self) -> bool:
        return True

    def send(self, data: bytes) -> dict:
        # Limpiar comandos binarios ESC/POS para visualizar en consola
        clean_text = re.sub(r'[\x00-\x09\x0b-\x1f\x7f-\xff]', '', data.decode("latin-1", "replace"))
        lines = [line.strip() for line in clean_text.split("\n") if line.strip()]

        print("\n" + "╔" + "═" * 36 + "╗")
        print("║   [SIMULADOR TICKET 58MM]          ║")
        print("╠" + "═" * 36 + "╣")
        for line in lines:
            line_clipped = line[:34]
            padding = 34 - len(line_clipped)
            print(f"║ {line_clipped}{' ' * padding} ║")
        print("╚" + "═" * 36 + "╝\n")

        return {
            "success": True,
            "transport": self.name,
            "simulated": True,
            "bytes_sent": len(data)
        }
