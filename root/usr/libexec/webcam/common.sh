# ---------------------------------------------------
# Funzioni comuni per i dati strutturati di Webcam 2.0: JSON, identità
# del router, portal (HTTPS), code su file e contatori della fotocamera.
#
# Si include dopo webcam.cfg:
#   . /usr/bin/webcam.cfg
#   . /usr/libexec/webcam/common.sh
#
# Formati (photo/1, telemetry/1, event/1) e API: vedi il contratto dei
# dati in webcam-portal/docs/contratto/.
# ---------------------------------------------------

WC_NTP_FLAG=/var/run/webcam_ntp_synced
WC_VERSION_FILE=/usr/share/webcam/version
# Contatori della fotocamera: in RAM ad ogni scatto, nella flash al
# massimo una volta l'ora (vedi counters_persist)
WC_COUNTERS=/tmp/webcam/counters
WC_COUNTERS_FLASH=/etc/webcam/counters
WC_COUNTERS_SAVE_EVERY=3600
WC_CAMERA_INFO="$WC_STATE_DIR/camera_info.json"
WC_VICTRON_JSON="$WC_STATE_DIR/victron.json"
WC_RETRY_AT="$WC_STATE_DIR/portal_retry_at"

# ---------------------------------------------------
# JSON
# ---------------------------------------------------

# Stringa JSON con escape di \ e " (null se vuota). Gli a capo e le
# tabulazioni diventano spazi, così un messaggio d'errore non rompe il file.
json_str() {
	[ -n "$1" ] || { echo null; return; }
	printf '"%s"' "$(printf '%s' "$1" | tr '\n\t\r' '   ' | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

# Intero (anche negativo), altrimenti null
json_num() {
	case "$1" in
		''|-|*[!0-9-]*|?*-*) echo null ;;
		*) echo "$1" | sed 's/^\(-\{0,1\}\)0*\([0-9]\)/\1\2/' ;;
	esac
}
json_int() { json_num "$@"; }

# Numero decimale (13.21, -0.5), altrimenti null
json_dec() {
	if printf '%s' "$1" | grep -Eq '^-?[0-9]+(\.[0-9]+)?$'; then
		printf '%s' "$1" | sed 's/^\(-\{0,1\}\)0*\([0-9]\)/\1\2/'
	elif printf '%s' "$1" | grep -Eq '^-?\.[0-9]+$'; then
		printf '%s' "$1" | sed 's/^\(-\{0,1\}\)\./\10./'
	else
		echo null
	fi
}

# 1/true/yes/on -> true, 0/false/no/off -> false, altrimenti null
json_bool() {
	case "$1" in
		1|true|yes|on|ON) echo true ;;
		0|false|no|off|OFF) echo false ;;
		*) echo null ;;
	esac
}

# Oggetto JSON costruito a pezzi: in una funzione "local JO=''",
# poi jkv chiave valore_json ... e infine echo "{$JO}"
jkv() { JO="${JO:+$JO,}\"$1\":$2"; }

# Campo di primo livello di un file JSON (jsonfilter se c'è)
wc_jget() {
	[ -s "$1" ] || return 0
	if command -v jsonfilter >/dev/null 2>&1; then
		jsonfilter -i "$1" -e "@.$2" 2>/dev/null | head -n 1
	else
		tr -d '\n' < "$1" | sed -n "s/.*\"$2\" *: *\"\{0,1\}\([^\",}]*\).*/\1/p" | head -n 1
	fi
}

# Contenuto di un file JSON su una riga sola, se più recente di $2 secondi
wc_json_fresh() {
	local f="$1" max="$2" t
	[ -s "$f" ] || return 1
	t="$(date -r "$f" +%s 2>/dev/null)" || return 1
	[ $(( $(date +%s) - t )) -lt "$max" ] || return 1
	sed 's/^[[:space:]]*//' "$f" | tr -d '\n\r'
}

# ---------------------------------------------------
# Identità e ora
# ---------------------------------------------------

# MAC della prima scheda di rete fisica (come inventory_report)
get_mac() {
	local i m
	for i in eth0 br-lan $(ls /sys/class/net 2>/dev/null); do
		m="$(cat "/sys/class/net/$i/address" 2>/dev/null)"
		case "$m" in ''|00:00:00:00:00:00) continue ;; esac
		echo "$m" | tr 'A-F' 'a-f'
		return
	done
}

# Primi 8 caratteri esadecimali del boot_id: cambiano a ogni avvio
wc_boot_id() {
	tr -d '-' < /proc/sys/kernel/random/boot_id 2>/dev/null | cut -c1-8 | tr 'A-F' 'a-f'
}

wc_uptime() {
	cut -d. -f1 /proc/uptime
}

# true se l'ora è stata sincronizzata con NTP dopo l'ultimo avvio
wc_time_synced() {
	[ -f "$WC_NTP_FLAG" ] && echo true || echo false
}

wc_app_version() {
	cat "$WC_VERSION_FILE" 2>/dev/null
}

wc_board_fw() {
	wc_jget "$WC_STATE_DIR/status.json" board_fw
}

wc_hostname() {
	uci -q get system.@system[0].hostname || cat /proc/sys/kernel/hostname
}

# Esegue un comando con un tempo massimo, se c'è timeout di busybox
wc_timeout() {
	local s="$1"
	shift
	if command -v timeout >/dev/null 2>&1; then
		timeout "$s" "$@"
	else
		"$@"
	fi
}

# ---------------------------------------------------
# Lock con mkdir (come capture e serial); $2 = secondi oltre i quali
# il lock è considerato orfano, $3 = secondi di attesa (0 = nessuna)
# ---------------------------------------------------
wc_lock() {
	local dir="$1" stale="${2:-300}" wait="${3:-0}" n=0
	while ! mkdir "$dir" 2>/dev/null; do
		if [ $(( $(date +%s) - $(date -r "$dir" +%s 2>/dev/null || echo 0) )) -gt "$stale" ]; then
			rmdir "$dir" 2>/dev/null
			continue
		fi
		[ "$n" -ge "$wait" ] && return 1
		sleep 1
		n=$(( n + 1 ))
	done
	return 0
}

wc_unlock() {
	rmdir "$1" 2>/dev/null
}

# ---------------------------------------------------
# Portal
# ---------------------------------------------------

# Base dell'URL senza "/" finale né "/api/v1" (accettati se scritti in LuCI)
wc_portal_base() {
	local u="${WC_PORTAL_URL%/}"
	u="${u%/api/v1}"
	echo "${u%/}"
}

wc_portal_enabled() {
	[ -n "$WC_PORTAL_URL" ] && [ -n "$WC_PORTAL_TOKEN" ]
}

# Destinazione delle foto: portal, ftp o both. Vuota = solo portal se
# portal_url è impostato, altrimenti FTP come prima della 1.1.
wc_upload_target() {
	case "$WC_UPLOAD_TARGET" in
		portal|ftp|both) echo "$WC_UPLOAD_TARGET" ;;
		*) [ -n "$WC_PORTAL_URL" ] && echo portal || echo ftp ;;
	esac
}

# Dopo un 429 il portal dice quando riprovare: fino ad allora niente richieste
wc_portal_wait_left() {
	local at now
	at="$(cat "$WC_RETRY_AT" 2>/dev/null)"
	now="$(date +%s)"
	case "$at" in ''|*[!0-9]*) echo 0; return ;; esac
	if [ "$at" -gt "$now" ] && [ $(( at - now )) -lt 7200 ]; then
		echo $(( at - now ))
	else
		echo 0
	fi
}

# Registra il Retry-After (secondi) delle intestazioni in $1
wc_portal_set_retry() {
	local ra
	ra="$(sed -n 's/^[Rr][Ee][Tt][Rr][Yy]-[Aa][Ff][Tt][Ee][Rr]: *\([0-9][0-9]*\).*/\1/p' "$1" 2>/dev/null | head -n 1)"
	case "$ra" in ''|*[!0-9]*) ra=60 ;; esac
	[ "$ra" -gt 3600 ] && ra=3600
	echo $(( $(date +%s) + ra )) > "$WC_RETRY_AT"
}

# Richiesta al portal: wc_portal_call PERCORSO FILE_RISPOSTA [argomenti curl]
# Stampa il codice HTTP (000 = rete assente o timeout). Le intestazioni
# vanno in FILE_RISPOSTA.hdr, l'errore di curl in FILE_RISPOSTA.err.
# Il token passa a curl dallo standard input (-K -), non sulla riga di
# comando, così non compare in ps.
wc_portal_call() {
	local path="$1" out="$2" code
	shift 2
	code="$(printf 'header = "Authorization: Bearer %s"\n' "$WC_PORTAL_TOKEN" | \
		curl -sS -K - --connect-timeout 30 -o "$out" -D "$out.hdr" -w '%{http_code}' \
		-H "User-Agent: luci-app-webcam/$(wc_app_version)" \
		"$@" "$(wc_portal_base)$path" 2>"$out.err")"
	case "$code" in ''|*[!0-9]*) code=000 ;; esac
	echo "$code"
}

# Testo breve del motivo di una risposta del portal ($1 codice, $2 file)
wc_portal_reason() {
	local code="$1" out="$2" err msg
	err="$(wc_jget "$out" error)"
	msg="$(wc_jget "$out" message)"
	case "$code" in
		000) echo "portal non raggiungibile ($(tail -n 1 "$out.err" 2>/dev/null | sed 's/^curl: //' | cut -c1-150))" ;;
		401) echo "token del portal mancante o sconosciuto (HTTP 401): controlla portal_token" ;;
		403) echo "token revocato o scaduto, webcam ritirata o HTTP senza TLS (HTTP 403)" ;;
		409) echo "il MAC del router non è quello della webcam del token (HTTP 409)" ;;
		429) echo "troppe richieste al portal (HTTP 429), riprovo più tardi" ;;
		5*) echo "errore del portal (HTTP $code)" ;;
		*) echo "HTTP $code${err:+ $err}${msg:+: $msg}" ;;
	esac | cut -c1-300
}

# ---------------------------------------------------
# Code su file di righe JSON (telemetria ed eventi)
#
# Una cartella con file NNNNNNNNNN.jsonl, una riga per elemento, dal più
# vecchio. Si aggiunge sempre all'ultimo file (nuovo ogni MAX righe) e si
# toglie dall'inizio, sotto lock: telemetry_sample e telemetry_send (o
# event e il suo invio) possono girare insieme.
# ---------------------------------------------------

jq_files() {
	ls "$1"/*.jsonl 2>/dev/null | sort
}

jq_count() {
	local f n=0 c
	for f in $(jq_files "$1"); do
		c=$(wc -l < "$f")
		n=$(( n + c ))
	done
	echo "$n"
}

# jq_append CARTELLA RIGA RIGHE_PER_FILE
jq_append() {
	local dir="$1" line="$2" max="${3:-12}" last n order
	mkdir -p "$dir" || return 1
	last="$(jq_files "$dir" | tail -n 1)"
	if [ -n "$last" ] && [ "$(wc -l < "$last")" -lt "$max" ]; then
		printf '%s\n' "$line" >> "$last"
		return
	fi
	order="$(cat "$dir/.order" 2>/dev/null)"
	case "$order" in ''|*[!0-9]*) order=0 ;; esac
	n=$(( order + 1 ))
	echo "$n" > "$dir/.order"
	printf '%s\n' "$line" > "$dir/$(printf '%010d' "$n").jsonl"
}

# Prime N righe, dalla più vecchia
jq_head() {
	local dir="$1" n="$2" f
	for f in $(jq_files "$dir"); do cat "$f"; done | head -n "$n"
}

# Toglie le prime N righe
jq_drop() {
	local dir="$1" n="$2" f c
	for f in $(jq_files "$dir"); do
		[ "$n" -gt 0 ] || break
		c=$(wc -l < "$f")
		if [ "$c" -le "$n" ]; then
			rm -f "$f"
			n=$(( n - c ))
		else
			sed -i "1,${n}d" "$f"
			n=0
		fi
	done
}

# Tiene al massimo MAX righe (cancella le più vecchie); stampa quante ne ha tolte
jq_prune() {
	local dir="$1" max="$2" total
	total=$(jq_count "$dir")
	if [ "$total" -gt "$max" ]; then
		jq_drop "$dir" $(( total - max ))
		echo $(( total - max ))
	else
		echo 0
	fi
}

# Dopo la sincronizzazione NTP corregge l'ora degli elementi dello stesso
# avvio presi con l'ora sbagliata: time = adesso - (uptime_adesso - uptime).
# Le righe sono scritte da noi e iniziano sempre con
#   {"id":"<boot>-...","time":T,"time_synced":false,"uptime":U,
jq_fix_time() {
	local dir="$1" boot now up f
	[ -f "$WC_NTP_FLAG" ] || return 0
	boot="$(wc_boot_id)"
	now="$(date +%s)"
	up="$(wc_uptime)"
	for f in $(jq_files "$dir"); do
		grep -q "^{\"id\":\"$boot-[^\"]*\",\"time\":[0-9]*,\"time_synced\":false," "$f" || continue
		awk -v boot="$boot" -v now="$now" -v up="$up" '
		index($0, "{\"id\":\"" boot "-") == 1 && index($0, ",\"time_synced\":false,\"uptime\":") > 0 {
			u = substr($0, index($0, ",\"uptime\":") + 10) + 0
			t = now - (up - u)
			sub(/,"time":[0-9]+,"time_synced":false,/, ",\"time\":" t ",\"time_synced\":true,\"time_corrected\":true,")
		}
		{ print }' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
	done
}

# ---------------------------------------------------
# Contatori della fotocamera (chiave=valore)
#
#   serial, model                 fotocamera a cui si riferiscono
#   shots_total                   scatti riusciti
#   power_on_s                    secondi con il relè della fotocamera acceso
#   power_cycles                  riavvii dal relè (camera_power_cycle)
#   capture_errors                scatti falliti
#   shots_initial_applied         ultimo valore iniziale applicato da LuCI
#   last_uptime                   uptime all'ultimo salvataggio (riavvii)
#
# Ogni modifica va nel file in RAM; la flash si scrive al massimo una
# volta l'ora (telemetry_sample) e all'arresto del servizio, per non
# consumarla. Dopo un'interruzione di corrente si perde al più un'ora.
# ---------------------------------------------------
WC_COUNTERS_LOCK=/var/lock/webcam_counters.lock

counters_load() {
	mkdir -p "${WC_COUNTERS%/*}"
	if [ ! -f "$WC_COUNTERS" ]; then
		if [ -f "$WC_COUNTERS_FLASH" ]; then
			cp "$WC_COUNTERS_FLASH" "$WC_COUNTERS"
		else
			: > "$WC_COUNTERS"
		fi
	fi
}

counter_get() {
	counters_load
	sed -n "s/^$1=//p" "$WC_COUNTERS" | tail -n 1
}

# counter_set CHIAVE VALORE (senza lock: usare dentro counters_edit)
counter_put() {
	grep -v "^$1=" "$WC_COUNTERS" > "$WC_COUNTERS.tmp" 2>/dev/null
	[ -n "$2" ] && echo "$1=$2" >> "$WC_COUNTERS.tmp"
	mv "$WC_COUNTERS.tmp" "$WC_COUNTERS"
}

counter_set() {
	counters_load
	wc_lock "$WC_COUNTERS_LOCK" 30 10 || return 1
	counter_put "$1" "$2"
	wc_unlock "$WC_COUNTERS_LOCK"
}

# counter_add CHIAVE [N]
counter_add() {
	local v
	counters_load
	wc_lock "$WC_COUNTERS_LOCK" 30 10 || return 1
	v="$(sed -n "s/^$1=//p" "$WC_COUNTERS" | tail -n 1)"
	case "$v" in ''|*[!0-9]*) v=0 ;; esac
	counter_put "$1" $(( v + ${2:-1} ))
	wc_unlock "$WC_COUNTERS_LOCK"
}

# Valore iniziale del contatore scatti impostato in LuCI (shots_initial):
# applicato una sola volta, quando cambia
counters_apply_initial() {
	local want applied
	want="$WC_SHOTS_INITIAL"
	case "$want" in ''|*[!0-9]*) return 0 ;; esac
	applied="$(counter_get shots_initial_applied)"
	[ "$want" = "$applied" ] && return 0
	wc_lock "$WC_COUNTERS_LOCK" 30 10 || return 1
	counter_put shots_total "$want"
	counter_put shots_initial_applied "$want"
	wc_unlock "$WC_COUNTERS_LOCK"
	logger -t "$WC_NAME counters" "Contatore scatti impostato al valore iniziale $want"
}

# Fotocamera diversa (numero di serie, o modello se manca): azzera i
# contatori e stampa "vecchio -> nuovo"; nulla se è la stessa
counters_camera() {
	local model="$1" serial="$2" old_m old_s id old_id
	[ -n "$model$serial" ] || return 0
	counters_load
	old_m="$(counter_get model)"
	old_s="$(counter_get serial)"
	id="${serial:-$model}"
	old_id="${old_s:-$old_m}"
	[ "$id" = "$old_id" ] && return 0
	wc_lock "$WC_COUNTERS_LOCK" 30 10 || return 1
	counter_put model "$model"
	counter_put serial "$serial"
	if [ -n "$old_id" ]; then
		counter_put shots_total 0
		counter_put power_on_s 0
		counter_put power_cycles 0
		counter_put capture_errors 0
		echo "${old_m:-?} ${old_s:-?} -> ${model:-?} ${serial:-?}"
	fi
	wc_unlock "$WC_COUNTERS_LOCK"
}

# Copia i contatori nella flash se sono cambiati e l'ultimo salvataggio
# ha più di un'ora (o subito con "force")
counters_persist() {
	local age
	counters_load
	counter_set last_uptime "$(wc_uptime)"
	if [ -f "$WC_COUNTERS_FLASH" ]; then
		grep -v '^last_uptime=' "$WC_COUNTERS" > "$WC_COUNTERS.cmp"
		if grep -v '^last_uptime=' "$WC_COUNTERS_FLASH" | cmp -s - "$WC_COUNTERS.cmp"; then
			rm -f "$WC_COUNTERS.cmp"
			[ "$1" = force ] || return 0
		fi
		rm -f "$WC_COUNTERS.cmp"
		age=$(( $(date +%s) - $(date -r "$WC_COUNTERS_FLASH" +%s 2>/dev/null || echo 0) ))
		[ "$1" = force ] || [ "$age" -ge "$WC_COUNTERS_SAVE_EVERY" ] || [ "$age" -lt 0 ] || return 0
	fi
	mkdir -p "${WC_COUNTERS_FLASH%/*}"
	cp "$WC_COUNTERS" "$WC_COUNTERS_FLASH.tmp" && mv "$WC_COUNTERS_FLASH.tmp" "$WC_COUNTERS_FLASH"
}

# Oggetto "camera" del lotto di telemetria (contatori della reflex)
counters_json() {
	local JO="" s info="$WC_CAMERA_INFO"
	counters_load
	jkv model "$(json_str "$(counter_get model)")"
	jkv serial "$(json_str "$(counter_get serial)")"
	jkv shutter_count "$(json_int "$(wc_jget "$info" shutter_count)")"
	jkv shots_total "$(json_int "$(counter_get shots_total)")"
	s="$(counter_get power_on_s)"
	case "$s" in
		''|*[!0-9]*) jkv power_on_hours null ;;
		*) jkv power_on_hours "$(awk -v s="$s" 'BEGIN { printf "%.1f", s / 3600 }')" ;;
	esac
	jkv power_cycles "$(json_int "$(counter_get power_cycles)")"
	jkv capture_errors "$(json_int "$(counter_get capture_errors)")"
	jkv battery_level "$(json_str "$(wc_jget "$info" battery_level)")"
	jkv read_at "$(json_int "$(wc_jget "$info" read_at)")"
	echo "{$JO}"
}

# ---------------------------------------------------
# Eventi: event TIPO GRAVITÀ MESSAGGIO [DATI_JSON] (in background, non blocca)
# ---------------------------------------------------
wc_event() {
	/usr/libexec/webcam/event "$@" </dev/null >/dev/null 2>&1 &
}
