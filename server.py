#!/usr/bin/env python3
# server.py - Printer Agent HTTP Service
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from transports import TransportManager
from escpos import build_receipt, build_raw

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Aviso] No se pudo leer config.json: {e}")
    return {}

config = load_config()
transport_manager = TransportManager(config)

class PrinterRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/", "/health", "/status"]:
            available_transports = transport_manager.list_transports()
            resolved = transport_manager.resolve_transport()
            self._send_json(200, {
                "status": "online",
                "service": "Printer Agent",
                "platform": sys.platform,
                "active_transport": resolved.name,
                "transports": available_transports,
                "timestamp": datetime.now().isoformat()
            })
        elif self.path == "/transports":
            self._send_json(200, {
                "transports": transport_manager.list_transports()
            })
        else:
            self._send_json(404, {"error": "Ruta no encontrada", "path": self.path})

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len) if content_len > 0 else b"{}"
        
        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except json.JSONDecodeError:
            self._send_json(400, {"error": "JSON inválido en el cuerpo de la petición"})
            return

        requested_transport = payload.get("transport")

        if self.path == "/print":
            try:
                if "ticket" in payload:
                    escpos_bytes = build_receipt(payload["ticket"])
                elif "raw_text" in payload:
                    escpos_bytes = build_raw(payload["raw_text"])
                else:
                    self._send_json(400, {"error": "Se requiere campo 'ticket' o 'raw_text'"})
                    return

                result = transport_manager.send(escpos_bytes, requested_transport)
                self._send_json(200, {
                    "status": "success",
                    "message": "Impresión enviada correctamente",
                    "result": result
                })
            except Exception as e:
                self._send_json(500, {
                    "status": "error",
                    "message": f"Error al imprimir: {str(e)}"
                })

        elif self.path == "/test":
            # Imprime ticket de prueba
            try:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                sample_ticket = {
                    "store_name": "PRINTER AGENT POC",
                    "address": "Goojprt PT-210 (58mm)",
                    "phone": "LAN HTTP -> Bluetooth / USB",
                    "invoice_no": "TEST-001",
                    "date": now_str,
                    "items": [
                        {"qty": 1, "name": "Conexión BT/USB", "price": "$0"},
                        {"qty": 1, "name": "Prueba de Concepto", "price": "$0"},
                        {"qty": 1, "name": "PWA / Web Worker", "price": "$0"}
                    ],
                    "subtotal": "$0",
                    "total": "$0.00",
                    "footer": "¡Impresora térmica lista!\nSoporte Windows & Linux"
                }
                escpos_bytes = build_receipt(sample_ticket)
                result = transport_manager.send(escpos_bytes, requested_transport)
                self._send_json(200, {
                    "status": "success",
                    "message": "Ticket de prueba impreso",
                    "result": result
                })
            except Exception as e:
                self._send_json(500, {
                    "status": "error",
                    "message": f"Error en test de impresión: {str(e)}"
                })
        else:
            self._send_json(404, {"error": "Ruta POST no encontrada", "path": self.path})

def run():
    port = int(config.get("port", 3333))
    host = config.get("host", "0.0.0.0")
    server_address = (host, port)
    
    httpd = HTTPServer(server_address, PrinterRequestHandler)
    print(f"==================================================")
    print(f" 🖨️  Printer Agent en ejecución")
    print(f" 📡 Escuchando en: http://{host}:{port}")
    print(f" 💻 Plataforma: {sys.platform}")
    active = transport_manager.resolve_transport()
    print(f" 🚀 Transporte predeterminado: {active.name}")
    print(f"==================================================")
    print(f"Rutas disponibles:")
    print(f"  GET  http://localhost:{port}/health")
    print(f"  POST http://localhost:{port}/print")
    print(f"  POST http://localhost:{port}/test")
    print(f"==================================================")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nDeteniendo Printer Agent...")
        httpd.server_close()

if __name__ == "__main__":
    run()
