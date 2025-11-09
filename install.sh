#!/bin/sh

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

# ----------------------------------------------------------
# Controllo e installazione/aggiornamento pacchetti richiesti
# ----------------------------------------------------------

REQUIRED_PACKAGES="
coreutils-stty
curl
gphoto2
libgphoto2-drivers-ptp2
"

echo ""
echo -e "${GREEN}Controllo dei pacchetti necessari...${NC}"

# Aggiorno la lista una volta sola
opkg update >/dev/null 2>&1

for PKG in $REQUIRED_PACKAGES; do
    INSTALLED_VERSION=$(opkg list-installed "$PKG" 2>/dev/null | awk '{print $3}')
    REPO_VERSION=$(opkg list "$PKG" 2>/dev/null | awk '{print $3}')

    if [ -n "$INSTALLED_VERSION" ]; then
        echo -e "${YELLOW}Trovato: ${PKG} (installato: $INSTALLED_VERSION, repo: $REPO_VERSION)${NC}"

        if [ "$INSTALLED_VERSION" = "$REPO_VERSION" ]; then
            echo "Versione già aggiornata, nessuna azione necessaria."
            echo ""
            continue
        fi

        printf "Aggiornare alla nuova versione? (s/N): "
        read -r resp
        case "$resp" in
            [sS]|[sS][iI]|[yY]|[yY][eE][sS])
                echo "Aggiorno $PKG..."
                if opkg install "$PKG" >/dev/null 2>&1; then
                    echo -e "${GREEN}Aggiornato: $PKG${NC}"
                else
                    echo -e "${RED}Errore durante l'aggiornamento di $PKG${NC}"
                fi
                ;;
            *)
                echo "Mantengo la versione installata di $PKG"
                ;;
        esac

    else
        echo -e "${RED}Pacchetto mancante: $PKG${NC}"
        printf "Vuoi installarlo? (S/n): "
        read -r resp
        case "$resp" in
            [nN]|[nN][oO])
                echo "Salto $PKG (non installato)"
                ;;
            *)
                echo "Installazione di $PKG..."
                if opkg install "$PKG" >/dev/null 2>&1; then
                    echo -e "${GREEN}Installato: $PKG${NC}"
                else
                    echo -e "${RED}Errore durante l'installazione di $PKG${NC}"
                fi
                ;;
        esac
    fi
    echo ""
done

echo -e "${GREEN}Controllo pacchetti completato${NC}"
echo ""

# ----------------------------------------------------------

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

    find root -type f | while read file; do
        dest_path="${file#root/}"
        dest_dir=$(dirname "/$dest_path")

        if [ "$dest_path" = "etc/config/webcam" ] && [ "$OVERWRITE_CONFIG" -eq 0 ]; then
            echo "  Salto: /$dest_path (configurazione esistente mantenuta)"
            continue
        fi

        mkdir -p "$dest_dir"

        if cp "$file" "/$dest_path" 2>/dev/null; then
            echo "  Copiato: $file → /$dest_path"

            if echo "/$dest_path" | grep -q "^/usr/bin/"; then
                chmod +x "/$dest_path" 2>/dev/null && \
                    echo "    Reso eseguibile: /$dest_path" || \
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
