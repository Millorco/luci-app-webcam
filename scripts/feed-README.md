# Feed opkg di luci-app-webcam

Questo branch è generato in automatico dal workflow `opkg feed`: non modificarlo a mano.

Sul router (OpenWrt 24.10 o precedenti, con `opkg`), una volta sola:

```sh
wget -O /tmp/webcam.pub https://raw.githubusercontent.com/Millorco/luci-app-webcam/feed/key.pub
opkg-key add /tmp/webcam.pub
echo "src/gz webcam https://raw.githubusercontent.com/Millorco/luci-app-webcam/feed" >> /etc/opkg/customfeeds.conf
opkg update
opkg install luci-app-webcam
```

Aggiornamenti: `opkg update && opkg upgrade luci-app-webcam`.
