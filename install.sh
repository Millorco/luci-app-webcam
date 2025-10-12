#!/bin/sh

# Script corretto per installare luci-app-webcam su OpenWrt
# htdocs → /www/
# root → /

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directory temporanea
TEMP_DIR="/tmp/luci-app-webcam-install"

echo -e "${GREEN}Inizio installazione di luci-app-webcam...${NC}"

# Verifica se siamo su OpenWrt
if [ ! -f "/etc/openwrt_release" ]; then
    echo -e "${RED}Errore: Questo script deve essere eseguito su OpenWrt${NC}"
    exit 1
fi

# Verifica se wget è installato
if ! command -v wget >/dev/null 2>&1; then
    echo -e "${RED}Errore: wget non è installato${NC}"
    echo "Installalo con: opkg update && opkg install wget"
    exit 1
fi

# Crea directory temporanea
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Scarica l'archivio del repository
LATEST_URL="https://github.com/Millorco/luci-app-webcam/archive/refs/heads/main.tar.gz"
echo "Scarico l'ultima versione da $LATEST_URL"

if wget -q "$LATEST_URL" -O webcam.tar.gz; then
    echo -e "${GREEN}Download completato${NC}"
    tar -xzf webcam.tar.gz
    cd luci-app-webcam-main
else
    echo -e "${RED}Errore nel download${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "${GREEN}Copia dei file nelle directory corrette...${NC}"

# 1. File web - htdocs → /www/
if [ -d "htdocs" ]; then
    echo "Copio file web (htdocs → /www/)..."
    cp -r htdocs/* /www/ 2>/dev/null || {
        echo -e "${YELLOW}Nota: Alcuni file web potrebbero già esistere${NC}"
    }
fi

# 2. File di sistema - root → /
if [ -d "root" ]; then
    echo "Copio file di sistema (root → /)..."
    
    # Copia ricorsivamente mantenendo la struttura delle directory
    find root -type f | while read file; do
        # Rimuove il prefisso "root/" dal percorso
        dest_path="${file#root/}"
        dest_dir=$(dirname "/$dest_path")
        
        # Crea la directory di destinazione se non esiste
        mkdir -p "$dest_dir"
        
        # Copia il file
        cp "$file" "/$dest_path" 2>/dev/null && \
            echo "  Copiato: $file → /$dest_path" || \
            echo -e "${YELLOW}  Attenzione: Impossibile copiare $file${NC}"
    done
fi

# 3. File LuCI - luasrc → /usr/lib/lua/luci/
if [ -d "luasrc" ]; then
    echo "Copio file LuCI (luasrc → /usr/lib/lua/luci/)..."
    
    if [ -d "luasrc/controller" ]; then
        mkdir -p /usr/lib/lua/luci/controller
        cp -r luasrc/controller/* /usr/lib/lua/luci/controller/ 2>/dev/null || true
    fi
    
    if [ -d "luasrc/model" ]; then
        mkdir -p /usr/lib/lua/luci/model
        cp -r luasrc/model/* /usr/lib/lua/luci/model/ 2>/dev/null || true
    fi
    
    if [ -d "luasrc/view" ]; then
        mkdir -p /usr/lib/lua/luci/view
        cp -r luasrc/view/* /usr/lib/lua/luci/view/ 2>/dev/null || true
    fi
fi

# Rende eseguibili gli script nella directory /etc/init.d/
if [ -d "/etc/init.d" ]; then
    echo "Rendo eseguibili gli script di init..."
    find /etc/init.d/ -name "*webcam*" -type f | while read script; do
        chmod +x "$script" 2>/dev/null && \
            echo "  Render eseguibile: $script" || \
            echo -e "${YELLOW}  Impossibile rendere eseguibile: $script${NC}"
    done
fi

# Pulisce la cache LuCI
echo "Pulisco la cache LuCI..."
rm -rf /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache

echo -e "${GREEN}Installazione completata!${NC}"
echo ""
echo -e "${YELLOW}Riepilogo copia file:${NC}"
echo "✓ htdocs/ → /www/"
echo "✓ root/ → /"
echo "✓ luasrc/ → /usr/lib/lua/luci/"

echo ""
echo -e "${YELLOW}Prossimi passi:${NC}"
echo "1. Riavvia LuCI: /etc/init.d/uhttpd restart"
echo "2. Accedi all'interfaccia web di OpenWrt"
echo "3. Verifica la presenza dell'app webcam"
echo "4. Se necessario, riavvia i servizi: /etc/init.d/webcam restart"

# Pulizia
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Pulizia file temporanei completata${NC}"
