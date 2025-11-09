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

# Verifica se wget e curl sono installati
for CMD in wget curl; do
    if ! command -v "$CMD" >/dev/null 2>&1; then
        echo -e "${RED}Errore: $CMD non è installato${NC}"
        echo "Installalo con: opkg update && opkg install $CMD"
        exit 1
    fi
done

# Funzione per chiedere il tag GitHub da scaricare
choose_github_tag() {
    echo ""
    echo "Recupero la lista dei tag da GitHub..."

    TAGS_JSON=$(curl -s "https://api.github.com/repos/Millorco/luci-app-webcam/tags")

    if [ -z "$TAGS_JSON" ]; then
        echo -e "${RED}Errore: impossibile contattare GitHub${NC}"
        exit 1
    fi

    TAGS=$(echo "$TAGS_JSON" | grep '"name"' | awk -F '"' '{print $4}')

    if [ -z "$TAGS" ]; then
        echo -e "${RED}Nessun tag trovato nel repository GitHub${NC}"
        exit 1
    fi

    echo ""
    echo "Versioni disponibili:"
    echo ""

    i=1
    for T in $TAGS; do
        echo "  $i) $T"
        eval "TAG_$i=\"$T\""
        i=$((i+1))
    done

    TOTAL=$((i-1))

    echo ""
    printf "Seleziona il numero della versione da installare (1-$TOTAL): "
    read -r CHOICE

    if ! echo "$CHOICE" | grep -qE "^[0-9]+$"; then
        echo -e "${RED}Scelta non valida${NC}"
        exit 1
    fi

    if [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "$TOTAL" ]; then
        echo -e "${RED}Numero fuori range${NC}"
        exit 1
    fi

    eval "SELECTED_TAG=\$TAG_$CHOICE"
    echo ""
    echo -e "${GREEN}Hai scelto il tag: $SELECTED_TAG${NC}"

    SELECTED_URL="https://github.com/Millorco/luci-app-webcam/archive/refs/tags/$SELECTED_TAG.tar.gz"

    echo "Download da: $SELECTED_URL"
    if wget -q "$SELECTED_URL" -O webcam.tar.gz; then
        echo -e "${GREEN}Download completato${NC}"
    else
        echo -e "${RED}Errore nel download della versione selezionata${NC}"
        exit 1
    fi
}

# Funzione per gestione pacchetti richiesti
check_and_install_pkg() {
    PKG="$1"

    INSTALLED_VERSION=$(opkg list-installed | grep "^$PKG " | awk '{print $3}')
    AVAILABLE_VERSION=$(opkg list | grep "^$PKG " | awk '{print $3}')

    if [ -z "$INSTALLED_VERSION" ]; then
        echo -e "${YELLOW}Pacchetto non installato: $PKG${NC}"
        printf "Vuoi installarlo? (S/n): "
        read -r r
        case "$r" in
            [nN]|[nN][oO]) return ;;
            *) opkg install "$PKG" ;;
        esac
        return
    fi

    if [ "$INSTALLED_VERSION" = "$AVAILABLE_VERSION" ]; then
        echo "✓ $PKG è già aggiornato alla versione $INSTALLED_VERSION"
        return
    fi

    echo -e "${YELLOW}Pacchetto $PKG installato in versione $INSTALLED_VERSION, disponibile $AVAILABLE_VERSION${NC}"
    printf "Aggiornare? (s/N): "
    read -r r
    case "$r" in
        [sS]|[sS][iI]|[yY]) opkg install "$PKG" ;;
        *) echo "Mantengo versione installata." ;;
    esac
}

# Pacchetti necessari
REQUIRED_PKGS="coreutils-stty curl gphoto2 libgphoto2-drivers-ptp2"

echo ""
echo -e "${GREEN}Verifica pacchetti necessari...${NC}"

for PKG in $REQUIRED_PKGS; do
    check_and_install_pkg "$PKG"
done

# Creazione directory temporanea
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Chiede all’utente quale tag GitHub installare
choose_github_tag

# Estrae il tar.gz
tar -xzf webcam.tar.gz

# Rileva automaticamente la directory estratta
EXTRACTED_DIR=$(tar -tf webcam.tar.gz | head -1 | cut -d/ -f1)
cd "$EXTRACTED_DIR"

echo -e "${GREEN}Installazione dei file...${NC}"

# Verifica configurazione
if [ -f "/etc/config/webcam" ]; then
    echo -e "${YELLOW}Il file /etc/config/webcam esiste già${NC}"
    printf "Vuoi sovrascriverlo? (s/N): "
    read -r resp
    case "$resp" in
        [sS]*|[yY]*) OVERWRITE_CONFIG=1 ;;
        *) OVERWRITE_CONFIG=0 ;;
    esac
else
    OVERWRITE_CONFIG=1
fi

# Copia htdocs
if [ -d "htdocs" ]; then
    echo "Copio interfaccia web..."
    cp -r htdocs/* /www/ 2>/dev/null || true
fi

# Copia root/*
if [ -d "root" ]; then
    echo "Copio file di sistema..."
    find root -type f | while read file; do
        dest_path="${file#root/}"
        dest_dir=$(dirname "/$dest_path")

        # Evita sovrascrittura config se richiesto
        if [ "$dest_path" = "etc/config/webcam" ] && [ "$OVERWRITE_CONFIG" -eq 0 ]; then
            echo "  Salto configurazione esistente"
            continue
        fi

        mkdir -p "$dest_dir"
        cp "$file" "/$dest_path"

        if echo "/$dest_path" | grep -q "^/usr/bin/"; then
            chmod +x "/$dest_path"
        fi
    done
fi

# Pulisce cache LuCI
echo "Pulizia cache LuCI..."
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache

# Abilita servizio webcam_capture
echo ""
echo "Abilitazione servizio webcam_capture..."

if chmod +x /etc/init.d/webcam_capture 2>/dev/null; then
    if /etc/init.d/webcam_capture enable 2>/dev/null; then
        /etc/init.d/webcam_capture start 2>/dev/null && \
            echo -e "${GREEN}Servizio webcam_capture avviato correttamente${NC}" || \
            echo -e "${RED}Errore: impossibile avviare il servizio${NC}"
    else
        echo -e "${RED}Errore: impossibile abilitare il servizio${NC}"
    fi
else
    echo -e "${RED}Errore: impossibile rendere il servizio eseguibile${NC}"
fi

# Pulizia
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}Installazione completata!${NC}"
