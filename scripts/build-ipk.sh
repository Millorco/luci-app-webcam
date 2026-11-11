#!/bin/bash
# Crea il pacchetto opkg (.ipk) di luci-app-webcam senza l'SDK di OpenWrt.
#
# Uso: scripts/build-ipk.sh <versione> <cartella-sorgenti> <cartella-output>
#   <versione>          tag della release, es. 1.0-beta3
#   <cartella-sorgenti> checkout del repository a quel tag
#   <cartella-output>   dove scrivere luci-app-webcam_<ver>_all.ipk
#
# Il pacchetto e' "all" (solo script shell e JavaScript), quindi va bene per
# qualunque router. Il formato e' quello di ipkg-build di OpenWrt: un tar.gz
# con debian-binary, control.tar.gz e data.tar.gz.
#
# La configurazione /etc/config/webcam e gli elenchi di ISO, diaframmi e tempi
# NON stanno nel pacchetto nella loro posizione finale: vengono installati in
# /usr/share/webcam/defaults e copiati al loro posto dal postinst solo se
# mancano. Cosi' "opkg upgrade" non tocca mai la configurazione ne' gli elenchi
# generati con iso_export / aperture_export / shutterspeed_export.

set -euo pipefail

TAG="${1:?versione mancante}"
SRC="$(cd "${2:?cartella sorgenti mancante}" && pwd)"
OUT="${3:?cartella output mancante}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

PKG=luci-app-webcam
# 1.0-beta3 -> 1.0~beta3-1: con "~" opkg ordina la beta prima della 1.0 finale.
VERSION="${TAG//-/\~}-1"
DEPENDS="libc, luci-base, gphoto2, libgphoto2-drivers-ptp2, curl, coreutils-stty"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DATA="$WORK/data"
CTRL="$WORK/control"
mkdir -p "$DATA" "$CTRL"

# --- data -------------------------------------------------------------------
cp -a "$SRC/root/." "$DATA/"
mkdir -p "$DATA/www"
cp -a "$SRC/htdocs/." "$DATA/www/"

DEF="$DATA/usr/share/webcam/defaults"
mkdir -p "$DEF"
mv "$DATA/etc/config/webcam" "$DEF/webcam.config"
rmdir "$DATA/etc/config" 2>/dev/null || true
for f in iso_data.json aperture_data.json shutterspeed_data.json; do
    if [ -f "$DATA/www/luci-static/resources/webcam/$f" ]; then
        mv "$DATA/www/luci-static/resources/webcam/$f" "$DEF/$f"
    fi
done

echo "$TAG" > "$DATA/usr/share/webcam/version"

find "$DATA" -type d -exec chmod 755 {} +
find "$DATA" -type f -exec chmod 644 {} +
chmod 755 "$DATA"/usr/bin/* "$DATA"/usr/libexec/webcam/* "$DATA"/etc/init.d/*

# --- control ----------------------------------------------------------------
INSTALLED_SIZE=$(du -sb "$DATA" | cut -f1)

cat > "$CTRL/control" <<EOF
Package: $PKG
Version: $VERSION
Depends: $DEPENDS
Source: https://github.com/Millorco/luci-app-webcam
SourceName: $PKG
License: GPL-2.0
Section: luci
SourceDateEpoch: ${SOURCE_DATE_EPOCH:-0}
Maintainer: Camillo Fagnano
Architecture: all
Installed-Size: $INSTALLED_SIZE
Description: LuCI Webcam app for gPhoto (time-lapse con reflex Canon EOS)
EOF

cat > "$CTRL/postinst" <<'EOF'
#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -s "${IPKG_INSTROOT}/lib/functions.sh" ] || exit 0
. "${IPKG_INSTROOT}/lib/functions.sh"

DEF="${IPKG_INSTROOT}/usr/share/webcam/defaults"
LISTS="${IPKG_INSTROOT}/www/luci-static/resources/webcam"

# Configurazione ed elenchi: solo se non esistono gia'.
[ -f "${IPKG_INSTROOT}/etc/config/webcam" ] || \
    cp "$DEF/webcam.config" "${IPKG_INSTROOT}/etc/config/webcam"
mkdir -p "$LISTS"
for f in iso_data.json aperture_data.json shutterspeed_data.json; do
    [ -f "$LISTS/$f" ] || cp "$DEF/$f" "$LISTS/$f"
done

# Abilita/avvia gli init script del pacchetto, esegue uci-defaults e svuota la
# cache di LuCI, come i pacchetti ufficiali.
default_postinst "$0" "$@"

if [ -z "${IPKG_INSTROOT}" ]; then
    rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
    /etc/init.d/rpcd reload >/dev/null 2>&1
    /etc/init.d/webcam_capture enable
    /etc/init.d/webcam_capture restart >/dev/null 2>&1
fi
exit 0
EOF

cat > "$CTRL/prerm" <<'EOF'
#!/bin/sh
[ -s "${IPKG_INSTROOT}/lib/functions.sh" ] || exit 0
. "${IPKG_INSTROOT}/lib/functions.sh"
default_prerm "$0" "$@"
EOF

chmod 755 "$CTRL/postinst" "$CTRL/prerm"

# --- assemblaggio -----------------------------------------------------------
TAR=(tar --format=gnu --numeric-owner --owner=0 --group=0 --sort=name
     --mtime="@${SOURCE_DATE_EPOCH:-0}")
( cd "$DATA" && "${TAR[@]}" -cf - . | gzip -9n > "$WORK/data.tar.gz" )
( cd "$CTRL" && "${TAR[@]}" -cf - . | gzip -9n > "$WORK/control.tar.gz" )
echo "2.0" > "$WORK/debian-binary"

IPK="$OUT/${PKG}_${VERSION}_all.ipk"
( cd "$WORK" && "${TAR[@]}" -cf - ./debian-binary ./data.tar.gz ./control.tar.gz \
    | gzip -9n > "$IPK" )

echo "$IPK"
