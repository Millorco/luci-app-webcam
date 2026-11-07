# Server centrale: log e monitoraggio

> **Senza VPN**: se ti basta mandare il syslog dei router direttamente all'IP pubblico del VPS, senza tunnel, usa [`victorialogs/`](victorialogs/README.md).

Questa cartella contiene un `docker-compose.yml` per un VPS che raccoglie i log di tutti i router con luci-app-webcam. Gli avvisi quando una webcam smette di caricare foto arrivano invece da [healthchecks.io](https://healthchecks.io), che gira fuori dal VPS: così ti avvisa anche se il VPS è giù.

```
router webcam1 ─┐                       VPS (Docker)
router webcam2 ─┼── WireGuard ──► wireguard (10.13.13.1) ── victorialogs :514 syslog, :9428 web
router ...     ─┘   UDP 51820

ogni router ── HTTPS ──► healthchecks.io ──► email / Telegram / ntfy
```

- **WireGuard** ([linuxserver/wireguard](https://docs.linuxserver.io/images/docker-wireguard/)): i router aprono il tunnel verso il VPS, quindi funziona anche dietro NAT o 4G. Log e dati viaggiano cifrati.
- **VictoriaLogs** ([docs](https://docs.victoriametrics.com/victorialogs/)): riceve il syslog di OpenWrt e ha un'interfaccia web per cercare nei log. Ascolta solo dentro il tunnel. Tiene 30 giorni di log (`-retentionPeriod`).

## 1. VPS

1. Copia la cartella `server/` sul VPS.
2. In `docker-compose.yml` imposta `SERVERURL` (nome DNS o IP pubblico del VPS) e `PEERS`, con un nome per ogni router più `pc` per il tuo computer. Solo lettere e numeri.
3. Apri la porta **UDP 51820** nel firewall del VPS e del provider. Non serve aprire altre porte.
4. Avvia:

   ```sh
   docker compose up -d
   ```

Per ogni peer viene creato `wireguard/peer_<nome>/peer_<nome>.conf`, con chiavi e indirizzo nel tunnel (il primo peer è `10.13.13.2`, poi `.3` e così via).

Per aggiungere un router più avanti, aggiungi il nome in fondo a `PEERS` e rilancia `docker compose up -d`: i peer esistenti restano uguali.

## 2. Router: tunnel e log remoto

Installa WireGuard (sui firmware GL.iNet di solito c'è già):

```sh
opkg update && opkg install wireguard-tools kmod-wireguard
```

Copia sul router il file `peer_webcam1.conf` del VPS, per esempio con `scp -O peer_webcam1.conf root@<router>:/tmp/`, poi:

```sh
central_log setup /tmp/peer_webcam1.conf
central_log status
rm /tmp/peer_webcam1.conf
```

`central_log setup`:
- crea l'interfaccia WireGuard `wglog` con le chiavi del file e il keepalive a 25 secondi;
- instrada nel tunnel solo la rete del tunnel (`10.13.13.0/24`), mai tutto il traffico;
- manda il log del router a `10.13.13.1:514` via TCP (opzioni `log_ip`, `log_port`, `log_proto` di **System → System → Logging**).

L'IP del syslog si può cambiare con un secondo argomento. `central_log off` toglie tunnel e log remoto. Il router non accetta connessioni in ingresso dal tunnel, perché `wglog` non è in nessuna zona del firewall.

`central_log status` mostra l'ultimo handshake e se il server risponde. Prova con `logger -t test "ciao dal router"`.

Il nome con cui il router compare nei log è il suo hostname (**System → System → Hostname**): dagli un nome diverso per ogni webcam.

Attenzione: i messaggi scritti durante l'avvio, prima che il tunnel sia su, possono andare persi o arrivare in ritardo.

<details>
<summary>Configurazione a mano, senza lo script</summary>

```sh
uci set network.wglog=interface
uci set network.wglog.proto='wireguard'
uci set network.wglog.private_key='<PrivateKey>'
uci add_list network.wglog.addresses='10.13.13.2/32'
uci add network wireguard_wglog
uci set network.@wireguard_wglog[-1].public_key='<PublicKey del server>'
uci set network.@wireguard_wglog[-1].preshared_key='<PresharedKey>'
uci set network.@wireguard_wglog[-1].endpoint_host='vps.example.com'
uci set network.@wireguard_wglog[-1].endpoint_port='51820'
uci set network.@wireguard_wglog[-1].persistent_keepalive='25'
uci set network.@wireguard_wglog[-1].route_allowed_ips='1'
uci add_list network.@wireguard_wglog[-1].allowed_ips='10.13.13.0/24'
uci commit network
uci set system.@system[0].log_ip='10.13.13.1'
uci set system.@system[0].log_port='514'
uci set system.@system[0].log_proto='tcp'
uci commit system
/etc/init.d/network reload; /etc/init.d/log restart
```

</details>

## 3. Consultare i log

L'interfaccia di VictoriaLogs è su `http://10.13.13.1:9428/select/vmui/` dal peer `pc`, oppure, senza tunnel, con un tunnel SSH verso il VPS:

```sh
ssh -L 9428:127.0.0.1:9428 utente@vps.example.com
# poi apri http://localhost:9428/select/vmui/
```

Query utili ([LogsQL](https://docs.victoriametrics.com/victorialogs/logsql/)):

| Query | Cosa mostra |
|---|---|
| `_time:1h` | tutto l'ultima ora |
| `hostname:webcam1` | solo un router |
| `_time:24h ERRORE` | gli errori di scatto e upload dell'ultimo giorno |
| `_time:7d "servizio avviato"` | gli avvii del servizio, quindi anche i riavvii del router |

## 4. Avvisi con healthchecks.io

1. Su [healthchecks.io](https://healthchecks.io) crea un check per ogni webcam, con lo stesso nome del router.
2. **Period**: l'intervallo di scatto (*Photo Time Schedule*). **Grace time**: almeno il doppio, così un singolo scatto saltato non manda allarmi.
3. Aggiungi un'integrazione per gli avvisi (email, Telegram, ntfy…).
4. Copia il *ping URL* (`https://hc-ping.com/<uuid>`) nella pagina LuCI **Webcam → System → Monitoring**.

Cosa manda il router:

- dopo ogni foto caricata, un ping di successo;
- a ogni errore di scatto o upload, un ping `/fail` con il messaggio d'errore: l'allarme arriva subito;
- all'avvio del servizio, una riga nel registro del check con l'uptime del router: un uptime di pochi secondi vuol dire che il router si è riavviato;
- quando attivi o disattivi la modalità manutenzione, una riga nel registro. In manutenzione non si scatta, quindi il check andrà in allarme: mettilo in pausa su healthchecks.io.

Se il router si spegne o perde la connessione non manda più niente, e l'allarme arriva alla fine del grace time.

Gli scatti di prova senza upload della pagina Status non mandano ping.
