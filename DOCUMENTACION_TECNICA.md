# Documentación Técnica: Printer Agent & Mini Facturas en Papel de Estampitas
**Impresora Térmica Portátil Goojprt PT-210 (58mm)**  
**Proyecto:** Web / PWA Workers ➔ HTTP LAN ➔ Printer Agent (Node.js) ➔ Bluetooth Virtual Serial

---

## 1. Visión General y Arquitectura

El objetivo del sistema es permitir que cualquier dispositivo (un teléfono móvil, tablet o PC ejecutando una aplicación Web o PWA) imprima mini facturas o recibos en una impresora térmica portátil **Goojprt PT-210** con **papel adhesivo de estampitas (stickers/etiquetas)**, de forma inalámbrica a través de la red local (LAN).

```
   📱 TELÉFONO / NAVEGADOR
  ┌─────────────────────────┐
  │   Web / PWA (workers)   │
  │  [Imprimir Mini Factura]│
  └────────────┬────────────┘
               │
          HTTP / LAN (ej. http://192.168.1.108:3333/print)
               │
               ▼
  ┌─────────────────────────┐
  │       PC (Host)         │
  │      Printer Agent      │
  │    (Node.js Server)     │
  └────────────┬────────────┘
               │
      Puerto Serie Virtual del Sistema Operativo
      - Linux:   /dev/rfcomm0
      - Windows: COM3 / \\.\COM3
               │
               ▼
  ┌─────────────────────────┐
  │  Bluetooth RFCOMM SPP   │
  │    (Canal 1 - PIN 0000) │
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  Goojprt PT-210 (58mm)  │
  │  Modo Estampita (TSPL)  │
  └─────────────────────────┘
```

---

## 2. Enfoque Inicial vs. Enfoque de Puerto Virtual (Estándar de la Industria)

### El Enfoque Inicial (Sockets Bluetooth Directos en Backend)
Inicialmente se intentó abrir un socket Bluetooth RFCOMM de bajo nivel directamente desde el código hacia la dirección MAC de la impresora.
* **Problema:** En el backend, las pilas Bluetooth difieren drásticamente entre sistemas operativos (BlueZ en Linux, WinRT en Windows), requieren librerías nativas compiladas en C++ (`node-gyp`) y sufren de bloqueos por exclusividad de canal.

### El Enfoque Definitivo (Puerto Virtual a Nivel de Sistema Operativo)
Siguiendo las mejores prácticas documentadas en la industria (referenciadas en las investigaciones de desarrollo térmico de *Parzibyte*):
1. **El Sistema Operativo gestiona el enlace Bluetooth:**
   - En **Linux:** Se asocia la dirección MAC a un archivo de dispositivo serial mediante `rfcomm bind 0 <MAC> 1`, creando `/dev/rfcomm0`.
   - En **Windows:** Windows crea de forma nativa un puerto COM saliente (ej. `COM3`).
2. **El agente en Node.js es 100% agnóstico:**
   - Escribir en la impresora es exactamente igual que escribir en un archivo o puerto USB.
   - No requiere compilar módulos nativos en C++.

---

## 3. Bitácora de Desafíos Encontrados y Soluciones Técnicas

Durante la fase de integración y pruebas surgieron varios comportamientos que impedían la impresión física. A continuación se documenta el análisis y la solución de cada uno:

### Desafío 1: Error `[Errno 16] Device or resource busy`
* **Síntoma:** Al enviar una impresión, el sistema arrojaba error de dispositivo ocupado y saltaba al simulador en consola (`mock`).
* **Causa Raíz:** En la terminal se había ejecutado `sudo rfcomm connect /dev/rfcomm0 ...`. El comando `connect` toma posesión exclusiva y permanente del canal RFCOMM. Cuando el agente intentaba abrir su propia conexión, el adaptador Bluetooth denegaba el acceso concurrente.
* **Solución:** Se liberó el canal cerrando `rfcomm connect` y se cambió a la directiva `rfcomm bind`, la cual crea el nodo en `/dev` sin bloquear el canal en la terminal.

---

### Desafío 2: Parpadeo extra rápido del LED azul y fallo de autenticación
* **Síntoma:** El LED azul de la impresora parpadeaba a una velocidad de 4-5 veces por segundo y la conexión se caía inmediatamente.
* **Causa Raíz:** La impresora no estaba emparejada en el subsistema de Bluetooth (`Paired: no`). El parpadeo ultra-rápido es el código de estado de la PT-210 solicitando el PIN de autenticación. Como nadie respondía al desafío, BlueZ arrojaba `AuthenticationFailed`.
* **Solución:** Se automatizó el emparejamiento con el PIN de fábrica (`0000`) y se marcó el dispositivo como confiable (`trust`):
  ```bash
  bluetoothctl pair 86:67:7A:0D:B7:9A      # Ingresando PIN: 0000
  bluetoothctl trust 86:67:7A:0D:B7:9A     # Recordar de forma permanente
  ```
  Una vez emparejada, la impresora reconoció la llave criptográfica y dejó de solicitar el PIN.

---

### Desafío 3: El hilo principal de Node.js se congelaba
* **Síntoma:** El servidor HTTP dejaba de responder en el puerto 3333 (`curl /health` se quedaba colgado indefinidamente).
* **Causa Raíz:** Al abrir `/dev/rfcomm0` con llamadas estándar sincrónicas (`fs.openSync` en modo bloqueante), el driver TTY de Linux detenía la ejecución del hilo principal en el punto del kernel `tty_port_block_til_ready` esperando la respuesta de hardware del canal Bluetooth.
* **Solución:** Se implementó la apertura en modo no bloqueante mediante la bandera `O_NONBLOCK`:
  ```javascript
  const flags = fs.constants.O_WRONLY | fs.constants.O_NONBLOCK;
  const fd = fs.openSync(devPath, flags);
  ```
  Esto garantiza que el servidor HTTP jamás se congele, incluso si la impresora se apaga o pierde cobertura.

---

### Desafío 4: El LED azul se encendía pero no salía papel
* **Síntoma:** El LED azul se encendía durante un par de segundos confirmando la recepción de datos, pero el cabezal no imprimía nada.
* **Causa Raíz A (Vaciado de Buffer / Drain):** Node.js escribía los bytes en `/dev/rfcomm0` y cerraba el descriptor de archivo (`closeSync`) en el mismo milisegundo. En dispositivos seriales virtuales, cerrar el archivo inmediatamente provoca que el kernel descarte los paquetes pendientes en cola antes de que salgan por la antena.
  - **Arreglo:** Se convirtió la función en asíncrona y se añadió una espera de vaciado de buffer (1.5 a 2 segundos) antes de cerrar el descriptor.
* **Causa Raíz B (Terminadores de línea):** Las impresoras térmicas seriales exigen retornos de carro completos (`\r\n` / CRLF) para volcar el búfer de línea al cabezal. Se actualizaron todos los saltos de línea a CRLF.

---

### Desafío 5: La Clave Definitiva ➔ Modo Recibo (ESC/POS) vs. Modo Estampita (TSPL)
* **Síntoma:** A pesar de tener conexión, PIN y buffer correctos, la impresora seguía sin moverse. Sin embargo, al pulsar el botón físico de la impresora, sí imprimía.
* **Causa Raíz:** La Goojprt PT-210 cuenta con **dos emulaciones de firmware**:
  1. **ESC/POS:** Para rollos continuos de papel térmico (tickets largos).
  2. **TSPL (Label Mode):** Para rollos con etiquetas adhesivas troqueladas (estampitas / stickers con separación física o *gap*).
  
  Al tener cargado papel de estampitas, la impresora estaba configurada en **Modo Etiqueta (TSPL)**. Cuando le enviábamos secuencias ESC/POS, el microcontrolador descartaba los datos porque no contenían las directivas geométricas de una etiqueta.
* **Solución:** Se construyó el módulo `tspl.js` con el formato nativo para etiquetas de 50mm x 40mm:
  ```tspl
  SIZE 50 mm, 40 mm
  GAP 2 mm, 0
  DIRECTION 1
  CLS
  TEXT 15,15,"3",0,1,1,"TIENDA EXPRESS"
  TEXT 15,43,"2",0,1,1,"TICKET #2026-001"
  BAR 15,65,350,2
  TEXT 15,73,"2",0,1,1,"2x Cafe          $6.000"
  TEXT 15,95,"2",0,1,1,"1x Pastel        $4.500"
  BAR 15,117,350,2
  TEXT 15,125,"3",0,1,1,"TOTAL: $10.500"
  PRINT 1,1
  ```
  Al enviar el primer comando de prueba con `"HOLA ESTAMPITA"`, la impresora calibró el papel adhesivo y lo expulsó impreso inmediatamente.

---

## 4. Estructura del Proyecto y Código Creado

```
practice/
├── workers/                         <-- Frontend (Web / PWA)
│   ├── index.html                   <-- Tarjeta de control, preview de estampita e input de IP
│   ├── index.js                     <-- Lógica fetch con persistencia de IP en localStorage
│   ├── sw.js                        <-- Service Worker existente
│   └── web-worker.js                <-- Web Worker existente
│
└── printer-agent/                   <-- Backend de Impresión (Node.js)
    ├── server.js                    <-- Servidor HTTP (0 dependencias) con CORS universal
    ├── tspl.js                      <-- Generador de comandos TSPL para estampitas/etiquetas
    ├── escpos.js                    <-- Generador de comandos ESC/POS para papel continuo
    ├── config.json                  <-- Configuración de puertos, MAC y parámetros por defecto
    ├── bind-printer.sh              <-- Script automatizado para vincular el puerto en Linux
    ├── run.sh                       <-- Lanzador rápido para Linux (node server.js)
    ├── run.bat                      <-- Lanzador rápido para Windows (node server.js)
    ├── package.json                 <-- Scripts de Node (npm start, npm test)
    └── transports/                  <-- Capa de abstracción de hardware
        ├── manager.js               <-- Enrutador inteligente con fallback a simulador
        ├── serialTransport.js       <-- Manejo de puertos COM y /dev/rfcomm0 (no bloqueante)
        ├── usbTransport.js          <-- Manejo de dispositivos USB (/dev/usb/lp0)
        └── mockTransport.js         <-- Simulador que dibuja el ticket en la terminal
```

---

## 5. Guía de Puesta en Marcha

### En Linux (Paso a Paso)

1. **Encender la impresora:**
   Presionar **POWER** durante 2-3 segundos hasta escuchar el pitido y ver el LED encendido.

2. **Vincular el puerto virtual:**
   En una terminal, ingresar a la carpeta del agente y ejecutar el script preparador:
   ```bash
   cd /home/camidev/Documentos/practice/printer-agent
   ./bind-printer.sh
   ```
   *(Este script limpia configuraciones anteriores, vincula la MAC `86:67:7A:0D:B7:9A` al Canal 1 y asigna permisos de lectura/escritura a `/dev/rfcomm0`)*.

3. **Iniciar el servidor:**
   ```bash
   npm start
   # O directamente:
   node server.js
   ```

4. **Imprimir desde la Web:**
   - En la PC: Abrir `http://localhost:3000`
   - En el celular (conectado al mismo Wi-Fi): Abrir `http://192.168.1.108:3000`
   - Asegurarse de que el campo de URL apunte a `http://192.168.1.108:3333`
   - Presionar **🖨️ Imprimir Mini Factura**.

---

### En Windows (Paso a Paso)

1. Ir a **Configuración > Dispositivos > Bluetooth**, encender el Bluetooth y buscar el dispositivo `P1_B79A` o `PT-210`.
2. Ingresar el PIN: `0000` (o `1234`).
3. Ir a **Más opciones de Bluetooth > pestaña Puertos COM** y anotar el puerto COM saliente asignado (ej. `COM3`).
4. En `config.json`, asegurar que `"port": "COM3"`.
5. Ejecutar haciendo doble clic en `run.bat` o desde CMD:
   ```cmd
   npm start
   ```

---

## 6. Endpoints de la API del Printer Agent

| Método | Ruta | Descripción | Payload de Ejemplo |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Chequeo de estado y transportes disponibles | Ninguno |
| `POST` | `/test` | Envía una estampita de diagnóstico con hora actual | Ninguno |
| `POST` | `/print` | Imprime la mini factura estructurada | Ver ejemplo abajo |

### Payload JSON para `/print`:
```json
{
  "mode": "label",
  "ticket": {
    "store_name": "TIENDA EXPRESS",
    "invoice_no": "FAC-00129",
    "date": "17:00",
    "items": [
---

## 7. Soporte Dual: Estampitas (TSPL) vs. Papel Continuo (ESC/POS)

El sistema soporta ambos tipos de papel sin requerir cambios de código:

1. **Modo Estampita / Etiqueta (`mode: "label"`)**:
   - Diseñado para stickers troquelados de 50mm con separación física (*gap*).
   - Utiliza comandos **TSPL** (`tspl.js`), enviando coordenadas precisas de impresión para que el texto encaje perfectamente en el sticker y la impresora detenga el rodillo exactamente en el corte.

2. **Modo Recibo Continuo (`mode: "receipt"`)**:
   - Diseñado para rollos de papel térmico estándar de factura/ticket.
   - Utiliza comandos universales **ESC/POS** (`escpos.js`), imprimiendo encabezado amplio, tabla de productos, totales, mensajes de pie y avance de 5 líneas para rasgar el ticket en la cuchilla.

### ¿Cómo alternar entre ambos modos?
- **Desde la Web (`workers`):** En el selector *"Tipo de Papel / Formato"*, selecciona:
  - `🏷️ Papel de Estampitas / Stickers (TSPL)` cuando tengas puesto el rollo de stickers.
  - `🧾 Papel Normal Continuo (ESC/POS Factura)` cuando pongas el rollo de papel normal.
- Tu preferencia se guarda automáticamente en `localStorage` del navegador.

