# App to controlla a reflex whith gPhoto2

This app is meant to be a starting point for developing new LuCI apps using the modern JavaScript client-rendered approach.
Previously the LuCI used a Lua server-side render approach which is deprecated now.

## Installation

To install the luci-app-webcam to your OpenWrt instance

```sh
wget https://raw.github.com/Millorco/luci-app-webcam/main/install.sh
chmod +x install.sh
./install.sh
```

### Dependance

```sh
opkg update
opkg install coreutils-stty
opkg install curl
opkg install gphoto2
opkg install libgphoto2-drivers-ptp2
```

# Application structure

```
.
├── htdocs
│   └── luci-static
│       └── resources
│           ├── view
│           │   └── webcam
│           │       ├── camera_setting.js
│           │       ├── schedule.js
│           │       ├── system_setting.js
│           │       └── up_server.js
│           │
│           └── webcam
│               ├──
│               ├──
│               └──
├── Makefile
├── po
│   ├── templates
│   │   └── example.pot
├── README.md
└── root
    ├── etc
    │   ├── config
    │   │   └── webcam
    │   └── crontabs
    │       └── root
    └── usr
        ├── bin
        │   ├── add_led_config
        │   ├── capture
        │   ├── heartbeat
        │   ├── read_temp
        │   ├── serialsend
        │   ├── test_serial
        │   └── webcam.cfg
        │ 
        └── share
            ├── luci
            │   └── menu.d
            │       └── luci-app-webcam.json
            └── rpcd
                └── acl.d
                    └── luci-app-webcam.json


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
