#!/usr/bin/env bash
# Vincula automáticamente cualquier impresora térmica Bluetooth a /dev/rfcomm0 en Linux
DIR="$(cd "$(dirname "$0")" && pwd)"
MAC="$1"

# 1. Si no se pasa como parámetro, intentar autodetectar la impresora emparejada en bluetoothctl
if [ -z "$MAC" ]; then
  DETECTED=$(bluetoothctl devices | grep -iE "P1|PT-210|MTP|POS|printer|thermal|innerprinter" | head -n 1 | awk '{print $2}')
  if [ -n "$DETECTED" ]; then
    MAC="$DETECTED"
    echo "🔍 Impresora Bluetooth autodetectada en Linux: $MAC"
  fi
fi

# 2. Si no se detectó en bluetoothctl, intentar leer de config.json
if [ -z "$MAC" ] && [ -f "$DIR/config.json" ]; then
  MAC=$(node -e 'try{const c=JSON.parse(fs.readFileSync("config.json"));console.log(c.bluetooth?.mac||"")}catch{console.log("")}' 2>/dev/null)
fi

# 3. Fallback por defecto si todo lo anterior no arrojó valor
MAC="${MAC:-86:67:7A:0D:B7:9A}"
CHANNEL=1

echo "==> Liberando dispositivo rfcomm0 previo en el kernel..."
sudo rfcomm release 0 2>/dev/null || true
sudo rm -f /dev/rfcomm0 2>/dev/null || true

echo "==> Vinculando $MAC (canal $CHANNEL) a /dev/rfcomm0..."
sudo rfcomm bind 0 "$MAC" "$CHANNEL"

echo "==> Asignando permisos de lectura/escritura..."
sudo chmod 666 /dev/rfcomm0 2>/dev/null || true

echo "==> Listo! /dev/rfcomm0 creado y listo para usar:"
ls -l /dev/rfcomm0
