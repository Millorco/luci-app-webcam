#!/bin/sh

# Script per installare luci-app-webcam su OpenWrt (senza git)
# Repository: https://github.com/Millorco/luci-app-webcam.git

echo "=== Installazione luci-app-webcam ==="
echo ""

# Verifica che wget o curl siano disponibili
if ! command -v wget &> /dev/null && ! command -v curl &> /dev/null; then
    echo "ERRORE: wget o curl non disponibili"
    exit 1
fi

# Directory temporanea
TMP_DIR="/tmp/luci-app-webcam"
ZIP_FILE="/tmp/webcam.zip"
INSTALL_DIR="/usr/lib/lua/luci"

echo "Download repository da GitHub..."
rm -rf "$TMP_DIR" "$ZIP_FILE"

# Scarica il repository come ZIP
if command -v wget &> /dev/null; then
    wget -O "$ZIP_FILE" "https://github.com/Millorco/luci-app-webcam/archive/refs/heads/master.zip"
else
    curl -L -o "$ZIP_FILE" "https://github.com/Millorco/luci-app-webcam/archive/refs/heads/master.zip"
fi

if [ $? -ne 0 ]; then
    echo "ERRORE: Impossibile scaricare il repository"
    exit 1
fi

echo "Estrazione archivio..."
mkdir -p "$TMP_DIR"
unzip -q "$ZIP_FILE" -d "$TMP_DIR"

if [ $? -ne 0 ]; then
    echo "ERRORE: Impossibile estrarre l'archivio"
    rm -f "$ZIP_FILE"
    exit 1
fi

# Trova la directory estratta (solitamente luci-app-webcam-master)
EXTRACTED_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "luci-app-webcam-*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERRORE: Directory estratta non trovata"
    rm -rf "$TMP_DIR" "$ZIP_FILE"
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
rm -rf "$TMP_DIR" "$ZIP_FILE"

# Riavvio servizi LuCI
echo "Riavvio servizi LuCI..."
/etc/init.d/uhttpd restart

echo ""
echo "=== Installazione completata ==="
echo "Accedi all'interfaccia LuCI per utilizzare l'applicazione"
echo "Potrebbe essere necessario svuotare la cache del browser"
