# VictoriaLogs senza VPN

Il modo più semplice di raccogliere i log di tutte le webcam: ogni router manda il proprio syslog direttamente all'IP pubblico del VPS, dove gira [VictoriaLogs](https://docs.victoriametrics.com/victorialogs/). Non servono tunnel né pacchetti in più sui router.

Il prezzo è che i log viaggiano **in chiaro** su Internet: logd di OpenWrt non supporta TLS. Nei log della webcam non ci sono password, ma se i router sono su reti di terzi o vuoi cifrare tutto, usa la versione con WireGuard in [`../`](../README.md).

## 1. VPS

```sh
cd server/victorialogs
openssl rand -base64 18 | tr -d '\n' > vl_password    # password dell'interfaccia
chmod 600 vl_password
docker compose up -d
```

- **5140/TCP** riceve il syslog ed è aperta su Internet.
- **9428** (interfaccia web e API) ascolta solo su `127.0.0.1` del VPS e chiede utente `admin` e la password di `vl_password`.
- I dati restano in `./vlogs`: 30 giorni, al massimo 5 GB.

### Limitare chi può scrivere nei log

Chiunque raggiunga la porta 5140 può scrivere righe finte nei log: non può leggerli né fare altro, ma conviene chiuderla.

**Attenzione**: le porte pubblicate da Docker **scavalcano ufw** e le normali regole `INPUT`. Il filtro va messo nella catena `DOCKER-USER`.

- **Router con IP pubblico fisso** (o un piccolo gruppo di indirizzi): accetta solo quelli.

  ```sh
  # sostituisci 203.0.113.10 con l'IP del router (ripeti la prima riga per ognuno)
  iptables -I DOCKER-USER -p tcp --dport 5140 -s 203.0.113.10 -j RETURN
  iptables -A DOCKER-USER -p tcp --dport 5140 -j DROP
  ```

  Per renderle permanenti usa `iptables-persistent` (Debian/Ubuntu), oppure il firewall del provider, che di solito è il modo più comodo.
- **Router in 4G o con IP che cambia**: non si può filtrare per IP. Lascia la porta aperta (5140 al posto della classica 514 evita gran parte delle scansioni automatiche) e, se un giorno arrivano righe estranee, passa alla versione con WireGuard.

Nel firewall del provider apri **5140/TCP** e non aprire la 9428.

## 2. Router

Da LuCI: **System → System → Logging**, con *External system log server* uguale all'IP pubblico (o al nome DNS) del VPS, *External system log server port* `5140` e *External system log server protocol* `TCP`. Oppure da SSH:

```sh
uci set system.@system[0].log_ip='203.0.113.50'     # IP o nome del VPS
uci set system.@system[0].log_port='5140'
uci set system.@system[0].log_proto='tcp'
uci commit system
/etc/init.d/log restart
logger -t test "ciao dal router"
```

Il nome con cui il router compare nei log è il suo hostname (**System → System → Hostname**): dagli un nome diverso per ogni webcam.

Per tornare indietro: `uci delete system.@system[0].log_ip; uci commit system; /etc/init.d/log restart`.

I messaggi scritti durante l'avvio, prima che la connessione sia su, possono andare persi o arrivare in ritardo.

## 3. Consultare i log

Dal tuo PC apri un tunnel SSH verso il VPS:

```sh
ssh -L 9428:127.0.0.1:9428 utente@vps.example.com
```

poi apri <http://localhost:9428/select/vmui/>, con utente `admin` e la password di `vl_password` (`cat vl_password` sul VPS).

Query utili ([LogsQL](https://docs.victoriametrics.com/victorialogs/logsql/)):

| Query | Cosa mostra |
|---|---|
| `_time:1h` | tutto l'ultima ora |
| `hostname:Webcam` | solo un router |
| `_time:24h ERRORE` | errori di scatto e upload dell'ultimo giorno |
| `_time:7d "servizio avviato"` | avvii del servizio, quindi anche i riavvii del router |

Se un giorno vuoi l'interfaccia raggiungibile da browser senza tunnel, mettila dietro un reverse proxy con HTTPS (es. Caddy) invece di pubblicare la 9428: la password in Basic Auth su HTTP viaggerebbe in chiaro.
