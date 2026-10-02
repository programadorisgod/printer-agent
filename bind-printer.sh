#!/usr/bin/env bash
# Vincula la impresora PT-210 al puerto virtual /dev/rfcomm0
MAC="86:67:7A:0D:B7:9A"
CHANNEL=1

echo "==> Limpiando archivos previos..."
sudo rm -f /dev/rfcomm0

echo "==> Vinculando $MAC (canal $CHANNEL) a /dev/rfcomm0..."
sudo rfcomm bind 0 "$MAC" "$CHANNEL"

echo "==> Asignando permisos..."
sudo chmod 666 /dev/rfcomm0

echo "==> Listo! /dev/rfcomm0 creado:"
ls -l /dev/rfcomm0
