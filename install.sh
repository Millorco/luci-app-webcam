#!/bin/sh

# Script per installare luci-app-webcam su OpenWrt
# Repository: https://github.com/Millorco/luci-app-webcam.git

echo "=== Installazione luci-app-webcam (ultima release) ==="
echo ""

# Verifica che wget o curl siano disponibili
if ! command -v wget &> /dev/null && ! command -v curl &> /dev/null; then
    echo "ERRORE: wget o curl non disponibili"
    exit 1
fi

# Verifica che tar sia disponibile
if ! command -v tar &> /dev/null; then
    echo "ERRORE: tar non disponibile"
    exit 1
fi

# Directory temporanea
TMP_DIR="/tmp/luci-app-webcam"
TAR_FILE="/tmp/webcam.tar.gz"
INSTALL_DIR="/usr/lib/lua/luci"

# Recupera l'URL dell'ultima release tramite GitHub API
echo "Rilevamento ultima release..."
LATEST_URL=$(curl -s https://api.github.com/repos/Millorco/luci-app-webcam/releases/latest | \
    grep "tarball_url" | head -n 1 | cut -d '"' -f 4)

if [ -z "$LATEST_URL" ]; then
    echo "ERRORE: impossibile trovare l'ultima release."
    exit 1
fi

echo "Ultima release: $LATEST_URL"

echo "Download repository (tar.gz) dalla release..."
rm -rf "$TMP_DIR" "$TAR_FILE"

if command -v wget &> /dev/null; then
    wget -O "$TAR_FILE" "$LATEST_URL"
else
    curl -L -o "$TAR_FILE" "$LATEST_URL"
fi

if [ $? -ne 0 ]; then
    echo "ERRORE: Impossibile scaricare il repository"
    exit 1
fi

echo "Estrazione archivio..."
mkdir -p "$TMP_DIR"
tar -xzf "$TAR_FILE" -C "$TMP_DIR"

if [ $? -ne 0 ]; then
    echo "ERRORE: Impossibile estrarre l'archivio"
    rm -f "$TAR_FILE"
    exit 1
fi

# Trova la directory estratta (di solito Millorco-luci-app-webcam-*)
EXTRACTED_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "*luci-app-webcam*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERRORE: Directory estratta non trovata"
    rm -rf "$TMP_DIR" "$TAR_FILE"
    exit 1
fi

echo "Installazione file..."

# Copia i file dell'applicazione LuCI
if [ -d "$EXTRACTED_DIR/luasrc" ]; then
    cp -r "$EXTRACTED_DIR/luasrc/"* "$INSTALL_DIR/" 2>/dev/null
    echo "- File Lua copiati"
fi

# Copia i file htdocs se presenti
if [ -d "$EXTRACTED_DIR/htdocs" ]; then
    mkdir -p /www
    cp -r "$EXTRACTED_DIR/htdocs/"* /www/ 2>/dev/null
    echo "- File htdocs copiati"
fi

# Copia i file root se presenti
if [ -d "$EXTRACTED_DIR/root" ]; then
    cp -r "$EXTRACTED_DIR/root/"* / 2>/dev/null
    echo "- File root copiati"

    # Rendi eseguibili solo i file copiati da root/usr/bin/
    if [ -d "$EXTRACTED_DIR/root/usr/bin" ]; then
        for file in "$EXTRACTED_DIR/root/usr/bin/"*; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                chmod +x "/usr/bin/$filename" 2>/dev/null
                echo "- /usr/bin/$filename reso eseguibile"
            fi
        done
    fi
fi

# Copia i file po (traduzioni) se presenti
if [ -d "$EXTRACTED_DIR/po" ]; then
    mkdir -p /usr/lib/lua/luci/i18n
    if command -v po2lmo &> /dev/null; then
        for po_file in "$EXTRACTED_DIR/po"/*.po; do
            if [ -f "$po_file" ]; then
                lang=$(basename "$po_file" .po)
                po2lmo "$po_file" "/usr/lib/lua/luci/i18n/webcam.$lang.lmo" 2>/dev/null
                echo "- Traduzione $lang installata"
            fi
        done
    else
        echo "- po2lmo non disponibile, traduzioni saltate"
    fi
fi

# Pulizia
echo "Pulizia file temporanei..."
rm -rf "$TMP_DIR" "$TAR_FILE"

# Riavvio servizi LuCI
echo "Riavvio servizi LuCI..."
/etc/init.d/uhttpd restart

echo ""
echo "=== Installazione completata ==="
echo "Accedi all'interfaccia LuCI per utilizzare l'applicazione"
echo "Potrebbe essere necessario svuotare la cache del browser"
