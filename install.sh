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

# Verifica se il file /etc/config/webcam esiste e chiedi conferma
if [ -f "/etc/config/webcam" ]; then
    echo -e "${YELLOW}Attenzione: Il file /etc/config/webcam esiste già${NC}"
    printf "Vuoi sovrascriverlo? (s/N): "
    read -r response
    case "$response" in
        [sS]|[sS][iI]|[yY]|[yY][eE][sS])
            echo "Sovrascrivo il file di configurazione..."
            OVERWRITE_CONFIG=1
            ;;
        *)
            echo "Mantengo il file di configurazione esistente"
            OVERWRITE_CONFIG=0
            ;;
    esac
else
    OVERWRITE_CONFIG=1
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
        
        # Se è il file di configurazione webcam e l'utente non vuole sovrascrivere, salta
        if [ "$dest_path" = "etc/config/webcam" ] && [ "$OVERWRITE_CONFIG" -eq 0 ]; then
            echo "  Salto: /$dest_path (configurazione esistente mantenuta)"
            continue
        fi
        
        # Crea la directory di destinazione se non esiste
        mkdir -p "$dest_dir"
        
        # Copia il file
        if cp "$file" "/$dest_path" 2>/dev/null; then
            echo "  Copiato: $file → /$dest_path"
            
            # Se il file è in /usr/bin/, rendilo eseguibile
            if echo "/$dest_path" | grep -q "^/usr/bin/"; then
                chmod +x "/$dest_path" 2>/dev/null && \
                    echo "    Render eseguibile: /$dest_path" || \
                    echo -e "${YELLOW}    Impossibile rendere eseguibile: /$dest_path${NC}"
            fi
        else
            echo -e "${YELLOW}  Attenzione: Impossibile copiare $file${NC}"
        fi
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
echo "✓ File in /usr/bin/ resi eseguibili"

echo ""
echo -e "${YELLOW}Prossimi passi:${NC}"
echo "1. Riavvia LuCI: /etc/init.d/uhttpd restart"
echo "2. Accedi all'interfaccia web di OpenWrt"
echo "3. Verifica la presenza dell'app webcam"
echo "4. Se necessario, riavvia i servizi: /etc/init.d/webcam restart"

# Pulizia
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Pulizia file temporanei completata${NC}"
