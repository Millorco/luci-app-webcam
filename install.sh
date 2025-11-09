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
# Funzione per ottenere le versioni disponibili da GitHub
# ----------------------------------------------------------

get_versions() {
    echo -e "${BLUE}Recupero versioni disponibili da GitHub...${NC}"
    
    # Crea directory temporanea per i file
    mkdir -p "$TEMP_DIR"
    
    # Ottieni i tag (releases)
    wget -qO "$TEMP_DIR/tags.json" "https://api.github.com/repos/$GITHUB_REPO/tags" 2>/dev/null || true
    
    # Ottieni i branch
    wget -qO "$TEMP_DIR/branches.json" "https://api.github.com/repos/$GITHUB_REPO/branches" 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}Versioni disponibili:${NC}"
    echo ""
    
    COUNTER=1
    
    # Processa i tag (releases)
    if [ -f "$TEMP_DIR/tags.json" ] && [ -s "$TEMP_DIR/tags.json" ]; then
        echo -e "${YELLOW}=== Release (Tag) ===${NC}"
        
        # Estrai i nomi dei tag - metodo più robusto
        grep -o '"name":"[^"]*"' "$TEMP_DIR/tags.json" | cut -d'"' -f4 > "$TEMP_DIR/tag_names.txt"
        
        if [ -s "$TEMP_DIR/tag_names.txt" ]; then
            while IFS= read -r tag; do
                echo "  [$COUNTER] $tag"
                echo "$tag" >> "$TEMP_DIR/all_versions.txt"
                echo "tag" >> "$TEMP_DIR/version_types.txt"
                COUNTER=$((COUNTER + 1))
            done < "$TEMP_DIR/tag_names.txt"
        fi
    fi
    
    # Processa i branch
    if [ -f "$TEMP_DIR/branches.json" ] && [ -s "$TEMP_DIR/branches.json" ]; then
        echo ""
        echo -e "${YELLOW}=== Branch ===${NC}"
        
        # Estrai i nomi dei branch
        grep -o '"name":"[^"]*"' "$TEMP_DIR/branches.json" | cut -d'"' -f4 > "$TEMP_DIR/branch_names.txt"
        
        if [ -s "$TEMP_DIR/branch_names.txt" ]; then
            while IFS= read -r branch; do
                echo "  [$COUNTER] $branch (branch)"
                echo "$branch" >> "$TEMP_DIR/all_versions.txt"
                echo "branch" >> "$TEMP_DIR/version_types.txt"
                COUNTER=$((COUNTER + 1))
            done < "$TEMP_DIR/branch_names.txt"
        fi
    fi
    
    # Verifica se abbiamo trovato almeno una versione
    if [ ! -f "$TEMP_DIR/all_versions.txt" ] || [ ! -s "$TEMP_DIR/all_versions.txt" ]; then
        echo -e "${RED}Errore: Nessuna versione trovata sul repository${NC}"
        echo -e "${YELLOW}Verifico la connessione a GitHub...${NC}"
        
        if wget -q --spider "https://api.github.com" 2>/dev/null; then
            echo -e "${RED}Connessione OK ma repository non accessibile${NC}"
            echo "Repository: https://github.com/$GITHUB_REPO"
        else
            echo -e "${RED}Impossibile connettersi a GitHub${NC}"
        fi
        
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
    
    # Default a 1 se vuoto
    if [ -z "$selection" ]; then
        selection=1
    fi
    
    # Verifica che sia un numero
    if ! echo "$selection" | grep -qE '^[0-9]+$'; then
        echo -e "${RED}Errore: Inserire un numero valido${NC}"
        cleanup
        exit 1
    fi
    
    # Conta quante versioni ci sono
    VERSION_COUNT=$(wc -l < "$TEMP_DIR/all_versions.txt")
    
    if [ "$selection" -lt 1 ] || [ "$selection" -gt "$VERSION_COUNT" ]; then
        echo -e "${RED}Errore: Selezione non valida (1-$VERSION_COUNT)${NC}"
        cleanup
        exit 1
    fi
    
    # Ottieni la versione selezionata
    SELECTED_VERSION=$(sed -n "${selection}p" "$TEMP_DIR/all_versions.txt")
    VERSION_TYPE=$(sed -n "${selection}p" "$TEMP_DIR/version_types.txt")
    
    echo -e "${GREEN}Versione selezionata: $SELECTED_VERSION ($VERSION_TYPE)${NC}"
    
    # Costruisci l'URL per il download
    if [ "$VERSION_TYPE" = "tag" ]; then
        DOWNLOAD_URL="https://github.com/$GITHUB_REPO/archive/refs/tags/$SELECTED_VERSION.tar.gz"
    else
        DOWNLOAD_URL="https://github.com/$GITHUB_REPO/archive/refs/heads/$SELECTED_VERSION.tar.gz"
    fi
    
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
}

# ----------------------------------------------------------
# Download e installazione
# ----------------------------------------------------------

download_and_install() {
    SELECTED_VERSION=$(cat "$TEMP_DIR/selected_version.tmp")
    DOWNLOAD_URL=$(cat "$TEMP_DIR/download_url.tmp")
    
    # Scarica l'archivio del repository
    echo "Scarico la versione $SELECTED_VERSION..."
    echo "URL: $DOWNLOAD_URL"

    if wget -q "$DOWNLOAD_URL" -O "$TEMP_DIR/webcam.tar.gz"; then
        echo -e "${GREEN}Download completato${NC}"
        
        cd "$TEMP_DIR" || exit 1
        tar -xzf webcam.tar.gz
        
        # Trova la directory estratta
        EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "luci-app-webcam-*" | head -n 1)
        
        if [ -z "$EXTRACTED_DIR" ]; then
            echo -e "${RED}Errore: Impossibile trovare la directory estratta${NC}"
            cleanup
            exit 1
        fi
        
        echo "Directory estratta: $EXTRACTED_DIR"
        
        # Debug: mostra contenuto directory TEMP_DIR
        echo -e "${BLUE}Contenuto $TEMP_DIR:${NC}"
        ls -la
        
        # Entra nella directory estratta con path assoluto
        WORK_DIR="$TEMP_DIR/$EXTRACTED_DIR"
        if [ ! -d "$WORK_DIR" ]; then
            # Prova senza ./
            EXTRACTED_DIR=$(echo "$EXTRACTED_DIR" | sed 's|^\./||')
            WORK_DIR="$TEMP_DIR/$EXTRACTED_DIR"
        fi
        
        cd "$WORK_DIR" || {
            echo -e "${RED}Errore: Impossibile entrare in $WORK_DIR${NC}"
            cleanup
            exit 1
        }
        
        # Debug: mostra contenuto directory estratta
        echo -e "${BLUE}Contenuto directory di lavoro $(pwd):${NC}"
        ls -la
        
    else
        echo -e "${RED}Errore nel download${NC}"
        echo "Verifica che la versione selezionata sia corretta"
        cleanup
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
        if cp -rv htdocs/* /www/ 2>&1; then
            echo -e "${GREEN}File web copiati${NC}"
        else
            echo -e "${YELLOW}Nota: Alcuni file web potrebbero già esistere${NC}"
        fi
    else
        echo -e "${YELLOW}Cartella htdocs non trovata${NC}"
    fi

    # 2. File di sistema - root → /
    if [ -d "root" ]; then
        echo "Copio file di sistema (root → /)..."
        
        # Usa find per elencare tutti i file
        find root -type f | while read -r file; do
            # Rimuove "root" dal percorso per ottenere il path di destinazione
            dest_path="${file#root}"
            dest_dir=$(dirname "$dest_path")

            # Controlla se dobbiamo saltare il file di configurazione
            if [ "$dest_path" = "/etc/config/webcam" ] && [ "$OVERWRITE_CONFIG" -eq 0 ]; then
                echo "  Salto: $dest_path (configurazione esistente mantenuta)"
                continue
            fi

            # Crea la directory di destinazione se non esiste
            mkdir -p "$dest_dir"

            # Copia il file
            if cp -v "$file" "$dest_path" 2>&1; then
                # Rendi eseguibili i file in /usr/bin/, /usr/sbin/, /etc/init.d/
                case "$dest_path" in
                    /usr/bin/*|/usr/sbin/*|/etc/init.d/*)
                        if chmod +x "$dest_path" 2>/dev/null; then
                            echo "    → Reso eseguibile: $dest_path"
                        else
                            echo -e "${YELLOW}    → Impossibile rendere eseguibile: $dest_path${NC}"
                        fi
                        ;;
                esac
            else
                echo -e "${YELLOW}  Errore copiando: $file${NC}"
            fi
        done
    else
        echo -e "${YELLOW}Cartella root non trovata${NC}"
    fi

    # Pulisce la cache LuCI
    echo "Pulisco la cache LuCI..."
    rm -rf /tmp/luci-indexcache
    rm -rf /tmp/luci-modulecache

    # Configura e avvia il servizio webcam_capture
    echo ""
    echo -e "${GREEN}Configurazione servizio webcam_capture...${NC}"
    
    if [ -f "/etc/init.d/webcam_capture" ]; then
        echo "Imposto permessi eseguibili per webcam_capture..."
        chmod +x /etc/init.d/webcam_capture
        
        echo "Abilito il servizio all'avvio..."
        /etc/init.d/webcam_capture enable
        
        echo "Avvio il servizio webcam_capture..."
        /etc/init.d/webcam_capture start
        
        echo -e "${GREEN}Servizio webcam_capture configurato e avviato${NC}"
    else
        echo -e "${YELLOW}Attenzione: /etc/init.d/webcam_capture non trovato${NC}"
        echo "Il servizio dovrà essere configurato manualmente"
    fi

    echo ""
    echo -e "${GREEN}Installazione completata!${NC}"
    echo ""
    echo -e "${YELLOW}Riepilogo installazione:${NC}"
    echo "✓ Versione installata: $SELECTED_VERSION"
    echo "✓ htdocs/ → /www/"
    echo "✓ root/ → / (preserva struttura directory)"
    echo "✓ File in /usr/bin/, /usr/sbin/, /etc/init.d/ resi eseguibili"

    echo ""
    echo -e "${YELLOW}Prossimi passi:${NC}"
    echo "1. Riavvia LuCI: /etc/init.d/uhttpd restart"
    echo "2. Accedi all'interfaccia web di OpenWrt"
    echo "3. Verifica la presenza dell'app webcam nel menu"
    echo "4. Controlla lo stato del servizio: /etc/init.d/webcam_capture status"
}

# ----------------------------------------------------------
# Pulizia
# ----------------------------------------------------------

cleanup() {
    rm -rf "$TEMP_DIR"
    echo -e "${GREEN}Pulizia file temporanei completata${NC}"
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------

# Ottieni le versioni disponibili
get_versions

# Seleziona la versione
select_version

# Installa i pacchetti richiesti
install_packages

# Scarica e installa
download_and_install

# Pulizia finale
cleanup
