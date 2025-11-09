#!/bin/sh

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directory temporanea
TEMP_DIR="/tmp/luci-app-webcam-install"
GITHUB_REPO="Millorco/luci-app-webcam"

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
# Funzione per ottenere le versioni disponibili (SOLO TAG)
# ----------------------------------------------------------

get_versions() {
    echo -e "${BLUE}Recupero versioni disponibili da GitHub...${NC}"
    
    mkdir -p "$TEMP_DIR"
    
    # Ottieni i tag (releases)
    wget -qO "$TEMP_DIR/tags.json" "https://api.github.com/repos/$GITHUB_REPO/tags" 2>/dev/null || true

    echo ""
    echo -e "${GREEN}Versioni disponibili (Release):${NC}"
    echo ""

    COUNTER=1
    
    # Processa i tag
    if [ -f "$TEMP_DIR/tags.json" ] && [ -s "$TEMP_DIR/tags.json" ]; then
        grep -o '"name":"[^"]*"' "$TEMP_DIR/tags.json" | cut -d'"' -f4 > "$TEMP_DIR/tag_names.txt"
        
        if [ -s "$TEMP_DIR/tag_names.txt" ]; then
            while IFS= read -r tag; do
                echo "  [$COUNTER] $tag"
                echo "$tag" >> "$TEMP_DIR/all_versions.txt"
                COUNTER=$((COUNTER + 1))
            done < "$TEMP_DIR/tag_names.txt"
        fi
    fi
    
    if [ ! -f "$TEMP_DIR/all_versions.txt" ] || [ ! -s "$TEMP_DIR/all_versions.txt" ]; then
        echo -e "${RED}Errore: Nessuna release trovata sul repository${NC}"
        cleanup
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}Trovate $((COUNTER - 1)) versioni${NC}"
}

# ----------------------------------------------------------
# Selezione versione
# ----------------------------------------------------------

select_version() {
    echo ""
    echo -e "${YELLOW}Seleziona la versione da installare:${NC}"
    printf "Inserisci il numero [1]: "
    read -r selection
    
    [ -z "$selection" ] && selection=1
    
    if ! echo "$selection" | grep -qE '^[0-9]+$'; then
        echo -e "${RED}Errore: Inserire un numero valido${NC}"
        cleanup
        exit 1
    fi
    
    VERSION_COUNT=$(wc -l < "$TEMP_DIR/all_versions.txt")
    
    if [ "$selection" -lt 1 ] || [ "$selection" -gt "$VERSION_COUNT" ]; then
        echo -e "${RED}Errore: Selezione non valida (1-$VERSION_COUNT)${NC}"
        cleanup
        exit 1
    fi
    
    SELECTED_VERSION=$(sed -n "${selection}p" "$TEMP_DIR/all_versions.txt")
    
    echo -e "${GREEN}Versione selezionata: $SELECTED_VERSION${NC}"
    
    DOWNLOAD_URL="https://github.com/$GITHUB_REPO/archive/refs/tags/$SELECTED_VERSION.tar.gz"
    
    echo "$SELECTED_VERSION" > "$TEMP_DIR/selected_version.tmp"
    echo "$DOWNLOAD_URL" > "$TEMP_DIR/download_url.tmp"
}

# ----------------------------------------------------------
# Controllo e installazione/aggiornamento pacchetti richiesti
# ----------------------------------------------------------

install_packages() {
    REQUIRED_PACKAGES="
coreutils-stty
curl
gphoto2
libgphoto2-drivers-ptp2
"

    echo ""
    echo -e "${GREEN}Controllo dei pacchetti necessari...${NC}"

    opkg update >/dev/null 2>&1

    for PKG in $REQUIRED_PACKAGES; do
        INSTALLED_VERSION=$(opkg list-installed "$PKG" 2>/dev/null | awk '{print $3}')
        REPO_VERSION=$(opkg list "$PKG" 2>/dev/null | awk '{print $3}')

        if [ -n "$INSTALLED_VERSION" ]; then
            echo -e "${YELLOW}Trovato: ${PKG} (installato: $INSTALLED_VERSION, repo: $REPO_VERSION)${NC}"

            if [ "$INSTALLED_VERSION" = "$REPO_VERSION" ]; then
                echo "Versione già aggiornata."
                echo ""
                continue
            fi

            printf "Aggiornare? (s/N): "
            read -r resp
            case "$resp" in
                [sS]|[yY])
                    echo "Aggiorno $PKG..."
                    opkg install "$PKG" >/dev/null 2>&1 || echo -e "${RED}Errore aggiornamento${NC}"
                    ;;
                *)
                    echo "Mantengo la versione installata."
                    ;;
            esac

        else
            echo -e "${RED}Pacchetto mancante: $PKG${NC}"
            printf "Vuoi installarlo? (S/n): "
            read -r resp
            case "$resp" in
                [nN])
                    echo "Salto $PKG"
                    ;;
                *)
                    echo "Installazione $PKG..."
                    opkg install "$PKG" >/dev/null 2>&1 || echo -e "${RED}Errore installazione${NC}"
                    ;;
            esac
        fi
        echo ""
    done

    echo -e "${GREEN}Controllo pacchetti completato${NC}"
}

# ----------------------------------------------------------
# Download e installazione
# ----------------------------------------------------------

download_and_install() {
    SELECTED_VERSION=$(cat "$TEMP_DIR/selected_version.tmp")
    DOWNLOAD_URL=$(cat "$TEMP_DIR/download_url.tmp")

    echo "Scarico $SELECTED_VERSION..."
    echo "URL: $DOWNLOAD_URL"

    if wget -q "$DOWNLOAD_URL" -O "$TEMP_DIR/webcam.tar.gz"; then
        echo -e "${GREEN}Download completato${NC}"
        
        cd "$TEMP_DIR" || exit 1
        tar -xzf webcam.tar.gz
        
        EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "luci-app-webcam-*" | head -n 1)
        
        [ -z "$EXTRACTED_DIR" ] && echo -e "${RED}Errore decompressione${NC}" && cleanup && exit 1
        
        WORK_DIR="$TEMP_DIR/$EXTRACTED_DIR"
        
        cd "$WORK_DIR" || { echo -e "${RED}Errore directory estratta${NC}"; cleanup; exit 1; }

    else
        echo -e "${RED}Errore download${NC}"
        cleanup
        exit 1
    fi

    # Config esistente
    if [ -f "/etc/config/webcam" ]; then
        printf "${YELLOW}Config già presente. Sovrascrivere? (s/N): ${NC}"
        read -r response
        case "$response" in
            [sS]|[yY])
                OVERWRITE_CONFIG=1
                ;;
            *)
                OVERWRITE_CONFIG=0
                ;;
        esac
    else
        OVERWRITE_CONFIG=1
    fi

    echo -e "${GREEN}Copia dei file...${NC}"

    # htdocs → /www
    if [ -d "htdocs" ]; then
        cp -rv htdocs/* /www/ 2>/dev/null || true
    fi

    # root → /
    if [ -d "root" ]; then
        find root -type f | while read -r file; do
            dest_path="${file#root}"
            dest_dir=$(dirname "$dest_path")

            if [ "$dest_path" = "/etc/config/webcam" ] && [ "$OVERWRITE_CONFIG" -eq 0 ]; then
                continue
            fi

            mkdir -p "$dest_dir"
            cp "$file" "$dest_path" 2>/dev/null || true

            case "$dest_path" in
                /usr/bin/*|/usr/sbin/*|/etc/init.d/*)
                    chmod +x "$dest_path" 2>/dev/null || true
                    ;;
            esac
        done
    fi

    echo "Pulizia cache LuCI..."
    rm -rf /tmp/luci-indexcache /tmp/luci-modulecache

    if [ -f "/etc/init.d/webcam_capture" ]; then
        chmod +x /etc/init.d/webcam_capture
        /etc/init.d/webcam_capture enable
        /etc/init.d/webcam_capture start
    fi

    echo -e "${GREEN}Installazione completata${NC}"
}

cleanup() {
    rm -rf "$TEMP_DIR"
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------

get_versions
select_version
install_packages
download_and_install
cleanup
