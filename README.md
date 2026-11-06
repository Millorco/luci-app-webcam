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

The script already installs the dependencies.

```sh
coreutils-stty
curl
gphoto2
libgphoto2-drivers-ptp2
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
│           │       ├── status.js
│           │       ├── system_setting.js
│           │       └── up_server.js
│           │
│           └── webcam
│               ├── aperture_data.json
│               ├── iso_data.json
│               └── shutterspeed_data.json
│
└── root
    ├── etc
    │   ├── config
    │   │   └── webcam
    │   │
    │   └── init.d
    │       └── webcam_capture   (aggiunge anche i job cron heartbeat/climate)
    │
    └── usr
        ├── bin
        │   ├── add_led_config
        │   ├── aperture_export
        │   ├── capture
        │   ├── capture_service
        │   ├── check_camera_model
        │   ├── climate
        │   ├── heartbeat
        │   ├── iso_export
        │   ├── read_temp
        │   ├── serialsend
        │   ├── shutterspeed_export
        │   └── webcam.cfg
        │
        ├── libexec
        │   └── webcam
        │       ├── serial      (accesso seriale con lock e pausa tra comandi)
        │       └── sun_times   (calcolo locale di alba e tramonto)
        │
        └── share
            ├── luci
            │   └── menu.d
            │       └── luci-app-webcam.json
            │
            └── rpcd
                └── acl.d
                    └── luci-app-webcam.json


```

# Funzionamento

- **Scatto**: `capture_service` esegue `capture` ogni `photo_time_lapse` minuti. Giorno e notte sono decisi calcolando alba e tramonto in locale dalle coordinate (nessuna API esterna). ISO, diaframma e tempo sono salvati come indici delle scelte di gphoto2 e applicati con `--set-config-index`.
- **Anti-appannamento**: `climate` (cron, ogni 5 minuti) legge temperatura e umidità dall'SHT31, calcola il punto di rugiada e accende riscaldamento e ventola quando la temperatura è vicina al punto di rugiada o sotto la soglia minima. Durante lo scatto il riscaldamento viene spento e poi ripristinato.
- **Upload**: FTP, FTPS (FTP su TLS) o SFTP (richiede curl con supporto SSH, verificabile con `curl -V`).
- **Stato**: la pagina *Servizi → Webcam → Status* mostra temperatura, umidità, punto di rugiada, stato del riscaldamento e ultimo scatto.

# Board

 - b - Segnale heartbeat 
 - C/c - Camera ON/OFF 
 - H/h - Riscaldamento ON/OFF
 - P/p - PC ON/OFF 
 - F/f - Ventola ON/OFF 
 - t - Lettura temperatura 
 - u - Lettura umidità 
 - d - Test connessione 
 - r - Reset Pc Camera
 - s - Stato su una riga (relè, sensore, heartbeat, uptime, numero di cicli di alimentazione)
 - v - Versione firmware
 - ? - Elenco comandi
 - w / W - (solo da FTDI) sospende per 60 minuti / riattiva il watchdog dell'heartbeat, per le prove al banco

Per sicurezza riscaldamento e ventola si spengono da soli se il router non ripete `H`/`F` entro 20 minuti (`climate` li reinvia ogni 5 minuti).

## Firmware della scheda (`board.ino`)

Compilazione con Arduino IDE: scheda **Arduino Uno** (ATmega328P a 16 MHz), libreria **Adafruit SHT31** (con la dipendenza Adafruit BusIO).

Se il chip è nuovo o non risponde, va prima caricato il bootloader tramite il connettore **ICSP** (USBasp o un Arduino usato come ISP, comando *Strumenti → Scrivi il bootloader* con scheda Arduino Uno). Poi lo sketch si carica dal connettore FTDI.

Connettore FTDI della scheda: 1 GND, 2 TX (va all'RXD dell'adattatore), 3 RX (va al TXD dell'adattatore), 4 5V, 5 DTR.

### Debug

Aprendo il monitor seriale sul connettore FTDI a **9600 baud** (senza fine riga) la scheda stampa all'avvio la versione, la causa del reset (accensione, DTR, brown-out, watchdog), la scansione del bus I2C e lo stato del sensore. Poi registra con timestamp ogni comando ricevuto dal router e ogni cambio dei relè, e ogni minuto stampa una riga di stato. Gli stessi comandi del router si possono digitare dal monitor seriale.

Il firmware legge un comando con `readString()`, che attende 1 secondo dopo l'ultimo carattere: per questo tutti gli script passano da `/usr/libexec/webcam/serial`, che serializza gli accessi e lascia 2 secondi tra un comando e l'altro.

# Screenshot

![System Setting](https://github.com/Millorco/luci-app-webcam/blob/b797289bb7683d42ad2c4d467c93871ec506cd6e/screenshot/system_setting.png)

![System Setting](https://github.com/Millorco/luci-app-webcam/blob/b797289bb7683d42ad2c4d467c93871ec506cd6e/screenshot/camera_setting.png)

![System Setting](https://github.com/Millorco/luci-app-webcam/blob/b797289bb7683d42ad2c4d467c93871ec506cd6e/screenshot/upload_server.png)
