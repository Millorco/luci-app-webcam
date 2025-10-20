# App to controlla a reflex whith gPhoto2

This app is meant to be a starting point for developing new LuCI apps using the modern JavaScript client-rendered approach.
Previously the LuCI used a Lua server-side render approach which is deprecated now.

## Installation

In all cases, you'll want to log out of the web interface and back in to force a cache refresh after installing the new package.

### From git
To install the luci-app-webcam to your OpenWrt instance

```sh
wget https://raw.github.com/Millorco/luci-app-webcam/main/install.sh
chmod +x install.sh
./install.sh
```

### Dipendenze

```sh
opkg update
opkg install coreutils-stty
opkg install curl
opkg install gphoto2
opkg install libgphoto2-drivers-ptp2
```


# Board

b - Segnale heartbeat

C/c - Camera ON/OFF

H/h - Riscaldamento ON/OFF
P/p - PC ON/OFF

F/f - Ventola ON/OFF

t - Lettura temperatura

u - Lettura umidità

s - Stato completo del sistema

n - Test connessione

r - Reset Pc Camera
