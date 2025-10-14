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

stty

```sh
opkg update
opkg install coreutils-stty
opkg install gphoto2
opkg install libgphoto2-drivers-ptp2
opkg install gphoto2 libgphoto2-drivers-iclick
opkg install libgphoto2-drivers-canon
```




