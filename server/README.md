# Server centrale: log e monitoraggio

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

## 2. Router: tunnel WireGuard

Installa i pacchetti (sulla GL-MT300N-V2 servono circa 1 MB di flash):

```sh
opkg update && opkg install wireguard-tools kmod-wireguard
```

Dal file `peer_webcam1.conf` del VPS copia `PrivateKey` e `Address` della sezione `[Interface]`, e `PublicKey`, `PresharedKey` ed `Endpoint` della sezione `[Peer]`, poi:

```sh
uci set network.wg0=interface
uci set network.wg0.proto='wireguard'
uci set network.wg0.private_key='<PrivateKey>'
uci add_list network.wg0.addresses='10.13.13.2/32'      # Address del peer

uci add network wireguard_wg0
uci set network.@wireguard_wg0[-1].description='vps'
uci set network.@wireguard_wg0[-1].public_key='<PublicKey del server>'
uci set network.@wireguard_wg0[-1].preshared_key='<PresharedKey>'
uci set network.@wireguard_wg0[-1].endpoint_host='vps.example.com'
uci set network.@wireguard_wg0[-1].endpoint_port='51820'
uci set network.@wireguard_wg0[-1].persistent_keepalive='25'
uci set network.@wireguard_wg0[-1].route_allowed_ips='1'
uci add_list network.@wireguard_wg0[-1].allowed_ips='10.13.13.0/24'

uci commit network
/etc/init.d/network reload
```

Verifica con `wg show` (deve comparire un `latest handshake`) e `ping 10.13.13.1`.

Il traffico verso Internet non passa dal tunnel: nel tunnel va solo la rete `10.13.13.0/24`. Il router non accetta connessioni in ingresso dal tunnel, perché `wg0` non è in nessuna zona del firewall; il traffico in uscita dal router è comunque permesso.

## 3. Router: log remoto

OpenWrt manda già il suo log a un server syslog, basta indicarlo. Da LuCI: **System → System → Logging**, con *External system log server* `10.13.13.1`, porta `514` e protocollo `TCP`. Oppure:

```sh
uci set system.@system[0].log_ip='10.13.13.1'
uci set system.@system[0].log_port='514'
uci set system.@system[0].log_proto='tcp'
uci commit system
/etc/init.d/log restart
```

Il nome con cui il router compare nei log è il suo hostname (**System → System → Hostname**): dagli un nome diverso per ogni webcam.

Prova con `logger -t test "ciao dal router"`.

Attenzione: i messaggi scritti durante l'avvio, prima che il tunnel sia su, possono andare persi o arrivare in ritardo.

## 4. Consultare i log

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

## 5. Avvisi con healthchecks.io

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
