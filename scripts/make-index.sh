#!/bin/bash
# Rigenera l'indice del feed opkg (Packages, Packages.gz e, se c'e' la chiave,
# Packages.sig) a partire da tutti i .ipk presenti nella cartella.
#
# Uso: scripts/make-index.sh <cartella-feed> [chiave-segreta-usign]
#
# La firma e' quella di usign, la stessa dei feed ufficiali di OpenWrt: opkg la
# verifica sul file Packages decompresso, con le chiavi in /etc/opkg/keys.

set -euo pipefail

FEED="$(cd "${1:?cartella feed mancante}" && pwd)"
KEY="${2:-}"

cd "$FEED"
: > Packages
for ipk in $(ls -1 *.ipk | sort -V); do
    tmp="$(mktemp -d)"
    tar -xzf "$ipk" -C "$tmp" ./control.tar.gz
    tar -xzf "$tmp/control.tar.gz" -C "$tmp" ./control
    # Campi del control, piu' quelli che servono a opkg per scaricare e
    # verificare il pacchetto. Description resta in fondo come negli indici
    # ufficiali.
    grep -v '^Description:' "$tmp/control"
    echo "Filename: $ipk"
    echo "Size: $(stat -c %s "$ipk")"
    echo "SHA256sum: $(sha256sum "$ipk" | cut -d' ' -f1)"
    grep '^Description:' "$tmp/control"
    echo
    rm -rf "$tmp"
done >> Packages

gzip -9nc Packages > Packages.gz

if [ -n "$KEY" ]; then
    usign -S -m Packages -s "$KEY" -x Packages.sig
    echo "Indice firmato: $FEED/Packages.sig"
else
    rm -f Packages.sig
    echo "ATTENZIONE: nessuna chiave, indice NON firmato" >&2
fi
