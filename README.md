Aggiungere sensore temperatura porta 

Aggiungere se presente riscaldament

agiungere se presente ventola

Whatchdog?

Eventuale stazone meteo

Leggere parametri config

/sbin/uci get webcam.@general[0].latitude


# Example app for js based Luci

This app is meant to be a starting point for developing new LuCI apps using the modern JavaScript client-rendered approach.
Previously the LuCI used a Lua server-side render approach which is deprecated now.

## Installation

In all cases, you'll want to log out of the web interface and back in to force a cache refresh after installing the new package.

### From git

To install the luci-app-example to your OpenWrt instance (assuming your OpenWRT instance is on 192.168.1.1):

```sh
scp -r root/* root@192.168.1.1:/
scp -r htdocs/* root@192.168.1.1:/www/
# execute the UCI defaults script to create the /etc/config/example
ssh root@192.168.1.1 "sh /etc/uci-defaults/80_example"
```

### From packages

Install the app on your OpenWrt installation. This can be an actual router/device, or something like a QEMU virtual machine.

`opkg install luci-app-example`

Visit the web UI for the device/virtual machine where the package was installed.
Log in to OpenWrt, and **Example** should be present in the navigation menu.

## Code format

The LuCI Javascript code should be indented with tabs.
`js-beautify/jsbeautifier` can help with this.
The examples in this application were formatted with:

    js-beautify -t -a -j -w 110 -r <filename>


## Translations

For a real world application (or changes to this example one that you wish to submit upstream), translations should be kept up to date.

To rebuild the translations file, from the root of the repository execute `./build/i18n-scan.pl applications/luci-app-example > applications/luci-app-example/po/templates/example.pot`

If the scan command fails with an error about being unable to open/find `msguniq`, install the GNU `gettext` package for your operating system.
