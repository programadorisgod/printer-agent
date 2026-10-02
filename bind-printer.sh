#!/usr/bin/env bash
# Vincula la impresora PT-210 al puerto virtual /dev/rfcomm0
MAC="86:67:7A:0D:B7:9A"
CHANNEL=1

echo "==> Liberando dispositivo previo en el kernel..."
sudo rfcomm release 0 2>/dev/null || true
sudo rm -f /dev/rfcomm0 2>/dev/null || true

echo "==> Vinculando $MAC (canal $CHANNEL) a /dev/rfcomm0..."
sudo rfcomm bind 0 "$MAC" "$CHANNEL"

echo "==> Asignando permisos..."
sudo chmod 666 /dev/rfcomm0 2>/dev/null || true

echo "==> Listo! /dev/rfcomm0 creado:"
ls -l /dev/rfcomm0
