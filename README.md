Aggiungere sensore temperatura porta 

Aggiungere se presente riscaldament

agiungere se presente ventola

Whatchdog?


# Example app for js based Luci

This app is meant to be a starting point for developing new LuCI apps using the modern JavaScript client-rendered approach.
Previously the LuCI used a Lua server-side render approach which is deprecated now.

## Installation

In all cases, you'll want to log out of the web interface and back in to force a cache refresh after installing the new package.

### From git

To install the luci-app-webcam to your OpenWrt instance (assuming your OpenWRT instance is on 192.168.1.1):

```sh
scp -r root/* root@192.168.1.1:/
scp -r htdocs/* root@192.168.1.1:/www/
# execute the UCI defaults script to create the /etc/config/webcam
ssh root@192.168.1.1 "sh /etc/uci-defaults/80_webcam"
```


