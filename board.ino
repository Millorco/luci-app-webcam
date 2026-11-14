/*
 * Webcam Board - firmware ATmega328P (16 MHz, bootloader Arduino Uno)
 *
 * Collegamenti (schema "Webcam Board 1.0"):
 *   D2  CAMERA   relè RLY3 (LOW = fotocamera alimentata, contatto NC)
 *   D3  HEATING  relè RLY1 (HIGH = riscaldamento acceso)
 *   D4  PC       relè RLY2 (LOW = router alimentato, contatto NC)
 *   D5  FUN      transistor Q1 (HIGH = ventola accesa)
 *   D6  RX1      SoftwareSerial dal router (tramite Q6)
 *   D7  TX1      SoftwareSerial verso il router (tramite Q5)
 *   D0/D1        seriale hardware sul connettore FTDI (debug)
 *   A4/A5        I2C verso i sensori SHT31: interno 0x44 (ADDR a GND),
 *                esterno 0x45 (ADDR a VCC), facoltativo
 *
 * Protocollo (identico su router e FTDI, 9600 8N1, un carattere per comando,
 * nessun terminatore richiesto; spazi e a capo vengono ignorati):
 *   b    heartbeat                       (nessuna risposta)
 *   C/c  fotocamera ON/OFF               (nessuna risposta)
 *   H/h  riscaldamento ON/OFF            (nessuna risposta)
 *   P/p  router ON/OFF                   (nessuna risposta)
 *   F/f  ventola ON/OFF                  (nessuna risposta)
 *   t    temperatura interna °C, es. "21.4" ("ERR" se il sensore non risponde)
 *   u    umidità interna %, es. "55.0"   ("ERR" se il sensore non risponde)
 *   T    temperatura esterna °C          ("ERR" se il sensore non risponde)
 *   U    umidità esterna %               ("ERR" se il sensore non risponde)
 *   d    test connessione                -> "OK"
 *   r    ciclo di alimentazione di router e fotocamera
 *   s    stato su una riga (relè, sensori, heartbeat, uptime, reset)
 *   v    versione firmware
 *   ?    elenco comandi
 * Solo dal connettore FTDI:
 *   w    sospende il watchdog dell'heartbeat per 60 minuti (prove al banco)
 *   W    riattiva subito il watchdog dell'heartbeat
 *   i    scansione del bus I2C
 *
 * Novità della 2.3: secondo sensore SHT31 esterno all'indirizzo 0x45
 * (comandi T/U, campi sht2/T2/H2 nello stato). Il sensore interno deve
 * stare a 0x44: solo lui comanda le protezioni del riscaldamento, che
 * misurano la temperatura dentro il case. Prima della 2.3 l'unico
 * sensore poteva stare indifferentemente a 0x44 o 0x45.
 *
 * Differenze rispetto alla versione precedente:
 *   - i comandi vengono eseguiti appena arriva il carattere: prima
 *     readString() aspettava 1 s e due comandi ravvicinati (es. "bh")
 *     venivano ignorati entrambi;
 *   - log di debug con timestamp sulla porta FTDI (comandi ricevuti,
 *     relè, sensore, watchdog) e diagnostica all'avvio (causa del reset,
 *     scansione I2C, stato iniziale);
 *   - stato iniziale dei relè impostato in modo esplicito;
 *   - ciclo di alimentazione non bloccante (5 s), contatore dei reset;
 *     se il router non riparte l'attesa raddoppia (10, 20, 40 min... max 2 h)
 *     e torna a 10 minuti al primo heartbeat;
 *   - riscaldamento e ventola si spengono da soli se il router non ripete
 *     H/F entro 20 minuti (climate lo reinvia ogni 5): se il router si
 *     blocca la resistenza non resta accesa;
 *   - sulla porta del router la scheda scrive solo le risposte ai comandi;
 *   - watchdog hardware AVR (8 s): se il programma si blocca il micro riparte;
 *   - protezione: riscaldamento spento oltre 45 °C o se il sensore
 *     non risponde per più di 10 minuti con il riscaldamento acceso;
 *   - il sensore viene reinizializzato automaticamente se non risponde.
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include <avr/wdt.h>
#include "Adafruit_SHT31.h"

#define FW_VERSION "2.3"

// --- Pin --------------------------------------------------------------------
const uint8_t PIN_CAMERA  = 2;
const uint8_t PIN_HEATING = 3;
const uint8_t PIN_PC      = 4;
const uint8_t PIN_FAN     = 5;
const uint8_t PIN_RX1     = 6;
const uint8_t PIN_TX1     = 7;

const uint8_t SHT31_ADDR_INT = 0x44;   // dentro il case (protezioni riscaldamento)
const uint8_t SHT31_ADDR_EXT = 0x45;   // fuori dal case, facoltativo

// --- Tempi ------------------------------------------------------------------
const unsigned long HEARTBEAT_TIMEOUT   = 600000UL; // 10 min senza 'b' -> ciclo di alimentazione
const unsigned long HEARTBEAT_MAX_WAIT  = 7200000UL; // attesa massima tra cicli se il router non riparte
const unsigned long WATCHDOG_SUSPEND    = 3600000UL; // durata della sospensione con 'w'
const unsigned long OUTPUT_KEEPALIVE    = 1200000UL; // H/F devono essere ripetuti entro 20 min
const unsigned long POWER_CYCLE_OFF     = 5000UL;   // durata dello spegnimento
const unsigned long SENSOR_INTERVAL     = 10000UL;  // lettura periodica del sensore
const unsigned long SENSOR_FAIL_TIMEOUT = 600000UL; // sensore muto con riscaldamento acceso
const unsigned long STATUS_LOG_INTERVAL = 60000UL;  // riga di stato sul debug
const float         HEATER_MAX_TEMP     = 45.0;     // protezione surriscaldamento

// --- Uscite -----------------------------------------------------------------
struct Output {
	const char *name;
	uint8_t pin;
	uint8_t onLevel;
	bool defaultOn;
	bool on;
};

enum { OUT_CAMERA, OUT_HEATING, OUT_PC, OUT_FAN, OUT_COUNT };

Output outputs[OUT_COUNT] = {
	{ "camera",  PIN_CAMERA,  LOW,  true,  false },
	{ "heating", PIN_HEATING, HIGH, false, false },
	{ "pc",      PIN_PC,      LOW,  true,  false },
	{ "fan",     PIN_FAN,     HIGH, false, false },
};

SoftwareSerial routerSerial(PIN_RX1, PIN_TX1);

// --- Sensori ----------------------------------------------------------------
struct Sensor {
	const char *name;
	uint8_t addr;
	Adafruit_SHT31 dev;
	bool ok;
	bool everSeen;           // trovato almeno una volta dall'avvio
	float temp;
	float hum;
	unsigned long lastRead;
	unsigned long lastOk;
};

Sensor sensors[2] = {
	{ "interno", SHT31_ADDR_INT, Adafruit_SHT31(), false, false, NAN, NAN, 0, 0 },
	{ "esterno", SHT31_ADDR_EXT, Adafruit_SHT31(), false, false, NAN, NAN, 0, 0 },
};
Sensor &sIn = sensors[0];
Sensor &sExt = sensors[1];

// --- Stato ------------------------------------------------------------------
unsigned long lastSensorRead = 0;

bool hbWatchdogEnabled = true;
unsigned long hbSuspendStart = 0;
bool hbEverReceived = false;
unsigned long lastHeartbeat = 0;
unsigned long hbWait = HEARTBEAT_TIMEOUT;
unsigned long lastHeatCmd = 0;
unsigned long lastFanCmd = 0;
unsigned long hbCount = 0;

bool powerCycling = false;
unsigned long powerCycleStart = 0;
unsigned int powerCycleCount = 0;

unsigned long lastStatusLog = 0;
unsigned long rxRouterCount = 0;

// Causa dell'ultimo reset (salvata prima che il core Arduino la cancelli)
uint8_t resetFlags __attribute__((section(".noinit")));

void saveResetFlags(void) __attribute__((naked, used, section(".init3")));
void saveResetFlags(void) {
	// Optiboot azzera MCUSR e passa il valore originale nel registro r2
	uint8_t r2val;
	__asm__ __volatile__("mov %0, r2" : "=r"(r2val));
	resetFlags = MCUSR ? MCUSR : r2val;
	MCUSR = 0;
	wdt_disable();
}

void scanI2C();

// --- Debug su FTDI ----------------------------------------------------------
void logPrefix() {
	unsigned long ms = millis();
	char buf[16];
	snprintf(buf, sizeof(buf), "[%7lu.%03u] ", ms / 1000UL, (unsigned)(ms % 1000UL));
	Serial.print(buf);
}

void logLine(const __FlashStringHelper *msg) {
	logPrefix();
	Serial.println(msg);
}

void logLine(const __FlashStringHelper *msg, const char *arg) {
	logPrefix();
	Serial.print(msg);
	Serial.println(arg);
}

// --- Uscite -----------------------------------------------------------------
void setOutput(uint8_t idx, bool on, const __FlashStringHelper *why) {
	Output &o = outputs[idx];
	digitalWrite(o.pin, on ? o.onLevel : !o.onLevel);
	bool changed = (o.on != on);
	o.on = on;
	logPrefix();
	Serial.print(o.name);
	Serial.print(on ? F(" ON") : F(" OFF"));
	if (!changed)
		Serial.print(F(" (invariato)"));
	Serial.print(F(" - "));
	Serial.println(why);
}

// --- Sensori ----------------------------------------------------------------
void logSensor(const Sensor &x, const __FlashStringHelper *msg) {
	logPrefix();
	Serial.print(F("SHT31 "));
	Serial.print(x.name);
	Serial.print(F(" (0x"));
	Serial.print(x.addr, HEX);
	Serial.print(F(") "));
	Serial.println(msg);
}

bool sensorBegin(Sensor &x) {
	x.ok = x.dev.begin(x.addr);
	if (x.ok) {
		x.everSeen = true;
		logSensor(x, F("inizializzato"));
	} else if (&x == &sIn || x.everSeen) {
		// L'esterno è facoltativo: se non c'è mai stato non lo si segnala
		logSensor(x, F("ERRORE: non trovato"));
	}
	return x.ok;
}

bool readSensor(Sensor &x) {
	float t = NAN, h = NAN;
	bool ok = x.dev.readBoth(&t, &h);
	x.lastRead = millis();
	if (!ok || isnan(t) || isnan(h)) {
		if (x.ok)
			logSensor(x, F("ERRORE: lettura fallita"));
		x.ok = false;
		return false;
	}
	if (!x.ok)
		logSensor(x, F("di nuovo disponibile"));
	x.ok = true;
	x.everSeen = true;
	x.lastOk = x.lastRead;
	x.temp = t;
	x.hum = h;
	return true;
}

// Lettura periodica; un sensore muto viene reinizializzato ogni minuto circa
void pollSensor(Sensor &x, unsigned long now) {
	if (!readSensor(x) && now - x.lastOk >= SENSOR_INTERVAL * 6)
		sensorBegin(x);
}

// --- Risposte ---------------------------------------------------------------
void printStatus(Stream &port) {
	unsigned long now = millis();
	port.print(F("S fw=" FW_VERSION));
	for (uint8_t i = 0; i < OUT_COUNT; i++) {
		port.print(' ');
		port.print(outputs[i].name);
		port.print('=');
		port.print(outputs[i].on ? 1 : 0);
	}
	port.print(F(" sht="));
	port.print(sIn.ok ? 1 : 0);
	port.print(F(" T="));
	if (isnan(sIn.temp)) port.print(F("NA")); else port.print(sIn.temp, 1);
	port.print(F(" H="));
	if (isnan(sIn.hum)) port.print(F("NA")); else port.print(sIn.hum, 1);
	port.print(F(" sht2="));
	port.print(sExt.ok ? 1 : 0);
	port.print(F(" T2="));
	if (isnan(sExt.temp)) port.print(F("NA")); else port.print(sExt.temp, 1);
	port.print(F(" H2="));
	if (isnan(sExt.hum)) port.print(F("NA")); else port.print(sExt.hum, 1);
	port.print(F(" hb_age="));
	if (hbEverReceived) port.print((now - lastHeartbeat) / 1000UL); else port.print(F("never"));
	port.print(F(" hb_count="));
	port.print(hbCount);
	port.print(F(" wd="));
	port.print(hbWatchdogEnabled ? 1 : 0);
	port.print(F(" cycles="));
	port.print(powerCycleCount);
	port.print(F(" up="));
	port.println(now / 1000UL);
}

void printHelp(Stream &port) {
	port.println(F("b heartbeat | C/c camera | H/h heating | P/p router | F/f fan"));
	port.println(F("t/u temp/hum interni | T/U temp/hum esterni | d test | r power cycle | s status | v version"));
	port.println(F("w/W (solo FTDI) sospendi 60 min / riattiva watchdog heartbeat | i scansione I2C"));
}

// --- Ciclo di alimentazione -------------------------------------------------
void startPowerCycle(const __FlashStringHelper *why) {
	if (powerCycling)
		return;
	logPrefix();
	Serial.print(F("Ciclo di alimentazione router+fotocamera: "));
	Serial.println(why);
	powerCycling = true;
	powerCycleStart = millis();
	setOutput(OUT_PC, false, why);
	setOutput(OUT_CAMERA, false, why);
}

void handlePowerCycle() {
	if (powerCycling && millis() - powerCycleStart >= POWER_CYCLE_OFF) {
		powerCycling = false;
		powerCycleCount++;
		setOutput(OUT_PC, true, F("fine ciclo di alimentazione"));
		setOutput(OUT_CAMERA, true, F("fine ciclo di alimentazione"));
		// Se il router non riparte, i cicli successivi si diradano
		// (10, 20, 40 min... fino a 2 h) per non consumare i relè
		lastHeartbeat = millis();
		hbWait = (hbWait * 2 > HEARTBEAT_MAX_WAIT) ? HEARTBEAT_MAX_WAIT : hbWait * 2;
		logPrefix();
		Serial.print(F("Prossimo ciclo se manca l'heartbeat per "));
		Serial.print(hbWait / 60000UL);
		Serial.println(F(" min"));
	}
}

// --- Comandi ----------------------------------------------------------------
void processCommand(char cmd, Stream &port, bool fromRouter) {
	if (cmd == '\r' || cmd == '\n' || cmd == ' ' || cmd == '\t')
		return;

	if (fromRouter)
		rxRouterCount++;

	if (cmd != 'b' || !fromRouter) {
		char src[24];
		snprintf(src, sizeof(src), "%s '%c' (0x%02X)", fromRouter ? "router" : "ftdi", cmd, (uint8_t)cmd);
		logLine(F("RX "), src);
	}

	switch (cmd) {
	case 'b':
		lastHeartbeat = millis();
		hbEverReceived = true;
		hbCount++;
		hbWait = HEARTBEAT_TIMEOUT;
		break;
	case 'C': setOutput(OUT_CAMERA, true, F("comando C")); break;
	case 'c': setOutput(OUT_CAMERA, false, F("comando c")); break;
	case 'H': lastHeatCmd = millis(); setOutput(OUT_HEATING, true, F("comando H")); break;
	case 'h': setOutput(OUT_HEATING, false, F("comando h")); break;
	case 'P': setOutput(OUT_PC, true, F("comando P")); break;
	case 'p': setOutput(OUT_PC, false, F("comando p")); break;
	case 'F': lastFanCmd = millis(); setOutput(OUT_FAN, true, F("comando F")); break;
	case 'f': setOutput(OUT_FAN, false, F("comando f")); break;
	case 't':
		if (readSensor(sIn)) port.println(sIn.temp, 1); else port.println(F("ERR"));
		break;
	case 'u':
		if (readSensor(sIn)) port.println(sIn.hum, 1); else port.println(F("ERR"));
		break;
	case 'T':
		if (readSensor(sExt)) port.println(sExt.temp, 1); else port.println(F("ERR"));
		break;
	case 'U':
		if (readSensor(sExt)) port.println(sExt.hum, 1); else port.println(F("ERR"));
		break;
	case 'd':
		port.println(F("OK"));
		break;
	case 'r':
		startPowerCycle(F("comando r"));
		break;
	case 's':
		printStatus(port);
		break;
	case 'v':
		port.println(F("Webcam Board fw " FW_VERSION));
		break;
	case '?':
		printHelp(port);
		break;
	case 'i':
		if (fromRouter)
			break;
		scanI2C();
		break;
	case 'w':
		if (fromRouter)
			break;
		hbWatchdogEnabled = false;
		hbSuspendStart = millis();
		logLine(F("Watchdog heartbeat SOSPESO per 60 minuti (W per riattivarlo)"));
		break;
	case 'W':
		if (fromRouter)
			break;
		hbWatchdogEnabled = true;
		lastHeartbeat = millis();
		logLine(F("Watchdog heartbeat ATTIVO"));
		break;
	default:
		logLine(F("Comando sconosciuto"));
		break;
	}
}

// --- Diagnostica all'avvio --------------------------------------------------
void printResetCause() {
	logPrefix();
	Serial.print(F("Causa reset (MCUSR=0x"));
	Serial.print(resetFlags, HEX);
	Serial.print(F("):"));
	if (resetFlags & _BV(PORF))  Serial.print(F(" accensione"));
	if (resetFlags & _BV(EXTRF)) Serial.print(F(" pin RESET/DTR"));
	if (resetFlags & _BV(BORF))  Serial.print(F(" brown-out (tensione bassa)"));
	if (resetFlags & _BV(WDRF))  Serial.print(F(" watchdog (programma bloccato)"));
	if (!resetFlags)             Serial.print(F(" sconosciuta"));
	Serial.println();
}

void checkI2CLines() {
	// Con il bus a riposo SDA e SCL devono essere alti (pull-up).
	// Una linea a 0 indica sensore non alimentato, corto o pull-up mancanti.
	pinMode(A4, INPUT);
	pinMode(A5, INPUT);
	delay(2);
	uint8_t sda = digitalRead(A4), scl = digitalRead(A5);
	logPrefix();
	Serial.print(F("Linee I2C a riposo: SDA(A4)="));
	Serial.print(sda);
	Serial.print(F(" SCL(A5)="));
	Serial.print(scl);
	if (!sda || !scl)
		Serial.print(F("  <-- linea a massa: controlla alimentazione del sensore e pull-up"));
	Serial.println();
}

void scanI2C() {
	logPrefix();
	Serial.print(F("Scansione I2C:"));
	uint8_t found = 0;
	for (uint8_t addr = 1; addr < 127; addr++) {
		wdt_reset();
		Wire.beginTransmission(addr);
		if (Wire.endTransmission() == 0) {
			Serial.print(F(" 0x"));
			if (addr < 16) Serial.print('0');
			Serial.print(addr, HEX);
			found++;
		}
	}
	if (!found)
		Serial.print(F(" nessun dispositivo (controlla SDA/SCL e 5V del sensore)"));
	Serial.println();
}

// --- Setup / loop -----------------------------------------------------------
void setup() {
	// Uscite subito nello stato di riposo, prima di qualsiasi altra cosa
	for (uint8_t i = 0; i < OUT_COUNT; i++) {
		Output &o = outputs[i];
		digitalWrite(o.pin, o.defaultOn ? o.onLevel : !o.onLevel);
		pinMode(o.pin, OUTPUT);
		o.on = o.defaultOn;
	}

	// Watchdog attivo subito: se qualcosa si blocca durante l'avvio il micro riparte
	wdt_enable(WDTO_8S);

	Serial.begin(9600);
	routerSerial.begin(9600);

	Serial.println();
	logLine(F("Webcam Board fw " FW_VERSION " avviata"));
	printResetCause();
	checkI2CLines();

	// Senza timeout la libreria Wire aspetta all'infinito se SDA o SCL
	// restano a massa, e la scheda non arriva mai al loop
	Wire.begin();
	Wire.setWireTimeout(25000, true);
	scanI2C();
	for (uint8_t i = 0; i < 2; i++) {
		if (sensorBegin(sensors[i]))
			readSensor(sensors[i]);
	}
	if (!sExt.ok)
		logLine(F("Sensore esterno (0x45) assente: si usa solo quello interno"));

	lastHeartbeat = millis();
	lastStatusLog = millis();

	printStatus(Serial);
	logLine(F("Pronto. Digita ? per l'elenco comandi."));
}

void loop() {
	wdt_reset();

	// Comandi dal router e dalla porta FTDI, un carattere alla volta
	while (routerSerial.available())
		processCommand((char)routerSerial.read(), routerSerial, true);
	while (Serial.available())
		processCommand((char)Serial.read(), Serial, false);

	// 'now' va letto DOPO i comandi: 'b', 'H' e 'F' salvano millis() nei
	// rispettivi timestamp, e un 'now' letto prima sarebbe più vecchio di
	// qualche ms. La sottrazione unsigned (now - lastHeartbeat) andrebbe
	// allora sotto zero e diventerebbe ~4 miliardi: il watchdog scatterebbe
	// proprio nell'istante in cui arriva l'heartbeat.
	unsigned long now = millis();

	// Fine della sospensione del watchdog
	if (!hbWatchdogEnabled && now - hbSuspendStart >= WATCHDOG_SUSPEND) {
		hbWatchdogEnabled = true;
		lastHeartbeat = now;
		logLine(F("Fine sospensione: watchdog heartbeat ATTIVO"));
	}

	// Watchdog dell'heartbeat: router bloccato -> ciclo di alimentazione
	if (hbWatchdogEnabled && !powerCycling && now - lastHeartbeat > hbWait)
		startPowerCycle(F("heartbeat assente"));
	handlePowerCycle();

	// Riscaldamento e ventola restano accesi solo se il router li conferma
	if (outputs[OUT_HEATING].on && now - lastHeatCmd > OUTPUT_KEEPALIVE)
		setOutput(OUT_HEATING, false, F("sicurezza: H non ripetuto da 20 minuti"));
	if (outputs[OUT_FAN].on && now - lastFanCmd > OUTPUT_KEEPALIVE)
		setOutput(OUT_FAN, false, F("sicurezza: F non ripetuto da 20 minuti"));

	// Lettura periodica del sensore e protezioni del riscaldamento
	// (le protezioni usano solo il sensore interno)
	if (now - lastSensorRead >= SENSOR_INTERVAL) {
		lastSensorRead = now;
		pollSensor(sIn, now);
		// L'esterno si cerca solo se c'è stato almeno una volta, oppure
		// ogni minuto circa per accorgersi di uno collegato dopo l'avvio
		if (sExt.everSeen)
			pollSensor(sExt, now);
		else if (now - sExt.lastRead >= SENSOR_INTERVAL * 6) {
			sExt.lastRead = now;
			if (sExt.dev.begin(sExt.addr) && readSensor(sExt))
				logSensor(sExt, F("trovato"));
		}
		if (outputs[OUT_HEATING].on) {
			if (sIn.ok && sIn.temp > HEATER_MAX_TEMP)
				setOutput(OUT_HEATING, false, F("protezione: temperatura interna oltre 45 C"));
			else if (!sIn.ok && now - sIn.lastOk > SENSOR_FAIL_TIMEOUT)
				setOutput(OUT_HEATING, false, F("protezione: sensore interno non disponibile"));
		}
	}

	// Riga di stato periodica sul debug
	if (now - lastStatusLog >= STATUS_LOG_INTERVAL) {
		lastStatusLog = now;
		logPrefix();
		printStatus(Serial);
	}
}
