# Printer Agent (Goojprt PT-210 - Estampitas TSPL & Recibos ESC/POS 58mm)

Agente de impresión ligero, agnóstico al transporte y multiplataforma (**Linux y Windows**) para impresoras térmicas como la **Goojprt PT-210**. Permite que cualquier aplicación Web o PWA (como [programadorisgod/workers](https://github.com/programadorisgod/workers)) envíe impresiones de mini facturas vía HTTP a través de la red local.

Soporta tanto **papel de estampitas / stickers (TSPL)** como **papel continuo de recibos (ESC/POS)**.

## Requisitos

- **Node.js 18+** (cero dependencias externas requeridas) o Python 3.8+.
- Impresora térmica Bluetooth/USB (Goojprt PT-210 o similar de 58mm).

---

## Configuración (`config.json`)

Edita `config.json` para ajustar los parámetros de tu impresora:

```json
{
  "port": 3333,
  "host": "0.0.0.0",
  "default_transport": "auto",
  "bluetooth": {
    "mac": "86:67:7A:0D:B7:9A",
    "channel": 1
  },
  "usb": {
    "device_path": "/dev/usb/lp0"
  },
  "serial": {
    "port": "COM3",
    "baudrate": 9600
  }
}
```

---

## Uso en Linux

1. **Bluetooth**:
   - Enlaza la impresora con `bluetoothctl`:
     ```bash
     bluetoothctl pair 86:67:7A:0D:B7:9A
     bluetoothctl trust 86:67:7A:0D:B7:9A
     ```
   - ¡Listo! El agente se conecta automáticamente mediante socket RFCOMM nativo sin necesidad de comandos antiguos ni privilegios root.

2. **USB**:
   - Conecta el cable USB. Aparecerá en `/dev/usb/lp0`. Asegúrate de pertenecer al grupo `lp` (`sudo usermod -aG lp $USER`).

3. **Ejecutar**:
   ```bash
   ./run.sh
   # O también:
   python3 server.py
   ```

---

## Uso en Windows

1. **Bluetooth**:
   - Ve a **Configuración > Dispositivos > Bluetooth** y agrega la impresora `P1_B79A` / `PT-210` (PIN habitual: `0000` o `1234`).
   - Ve a **Más opciones de Bluetooth > Puertos COM** y consulta el puerto COM saliente asignado (por ejemplo, `COM3` o `COM4`).
   - En `config.json`, configura `"port": "COM3"` en `"serial"`.

2. **USB**:
   - Al conectar por USB en Windows, se instala como puerto de impresora virtual o COM.

3. **Ejecutar**:
   - Doble clic en `run.bat` o:
     ```cmd
     python server.py
     ```

---

## Endpoints HTTP

- **`GET /health`**: Verifica estado del agente y lista transportes activos.
- **`POST /test`**: Envía un ticket de diagnóstico y prueba a la impresora.
- **`POST /print`**: Envía una mini factura estructurada en JSON o texto plano.

### Ejemplo de petición JSON para `/print`:

```json
{
  "transport": "auto",
  "ticket": {
    "store_name": "MI TIENDA",
    "address": "Calle 123",
    "phone": "3001234567",
    "invoice_no": "FAC-00129",
    "date": "2026-10-02 15:30",
    "items": [
      { "qty": 2, "name": "Empanada", "price": "$4.000", "total": "$8.000" },
      { "qty": 1, "name": "Gaseosa 400ml", "price": "$3.500", "total": "$3.500" }
    ],
    "subtotal": "$11.500",
    "tax": "$0",
    "total": "$11.500",
    "footer": "¡Gracias por su compra!\nConserve este ticket"
  }
}
```
