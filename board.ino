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
 *   A4/A5        I2C verso il sensore SHT31 (indirizzo 0x44)
 *
 * Protocollo (identico su router e FTDI, 9600 8N1, un carattere per comando,
 * nessun terminatore richiesto; spazi e a capo vengono ignorati):
 *   b    heartbeat                       (nessuna risposta)
 *   C/c  fotocamera ON/OFF               (nessuna risposta)
 *   H/h  riscaldamento ON/OFF            (nessuna risposta)
 *   P/p  router ON/OFF                   (nessuna risposta)
 *   F/f  ventola ON/OFF                  (nessuna risposta)
 *   t    temperatura °C, es. "21.4"      ("ERR" se il sensore non risponde)
 *   u    umidità %, es. "55.0"           ("ERR" se il sensore non risponde)
 *   d    test connessione                -> "OK"
 *   r    ciclo di alimentazione di router e fotocamera
 *   s    stato su una riga (relè, sensore, heartbeat, uptime, reset)
 *   v    versione firmware
 *   ?    elenco comandi
 * Solo dal connettore FTDI:
 *   w    sospende il watchdog dell'heartbeat per 60 minuti (prove al banco)
 *   W    riattiva subito il watchdog dell'heartbeat
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

#define FW_VERSION "2.0"

// --- Pin --------------------------------------------------------------------
const uint8_t PIN_CAMERA  = 2;
const uint8_t PIN_HEATING = 3;
const uint8_t PIN_PC      = 4;
const uint8_t PIN_FAN     = 5;
const uint8_t PIN_RX1     = 6;
const uint8_t PIN_TX1     = 7;

const uint8_t SHT31_ADDR[] = { 0x44, 0x45 };

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
Adafruit_SHT31 sht31 = Adafruit_SHT31();

// --- Stato ------------------------------------------------------------------
bool sensorOk = false;
float lastTemp = NAN;
float lastHum = NAN;
unsigned long lastSensorRead = 0;
unsigned long lastSensorOk = 0;

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

// --- Sensore ----------------------------------------------------------------
bool sensorBegin() {
	sensorOk = false;
	for (uint8_t i = 0; i < sizeof(SHT31_ADDR) && !sensorOk; i++) {
		if (sht31.begin(SHT31_ADDR[i])) {
			sensorOk = true;
			logPrefix();
			Serial.print(F("SHT31 inizializzato all'indirizzo 0x"));
			Serial.println(SHT31_ADDR[i], HEX);
		}
	}
	if (!sensorOk)
		logLine(F("ERRORE: SHT31 non trovato (0x44/0x45)"));
	return sensorOk;
}

bool readSensor() {
	float t = NAN, h = NAN;
	bool ok = sht31.readBoth(&t, &h);
	lastSensorRead = millis();
	if (!ok || isnan(t) || isnan(h)) {
		if (sensorOk)
			logLine(F("ERRORE: lettura SHT31 fallita"));
		sensorOk = false;
		return false;
	}
	if (!sensorOk)
		logLine(F("SHT31 di nuovo disponibile"));
	sensorOk = true;
	lastSensorOk = lastSensorRead;
	lastTemp = t;
	lastHum = h;
	return true;
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
	port.print(sensorOk ? 1 : 0);
	port.print(F(" T="));
	if (isnan(lastTemp)) port.print(F("NA")); else port.print(lastTemp, 1);
	port.print(F(" H="));
	if (isnan(lastHum)) port.print(F("NA")); else port.print(lastHum, 1);
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
	port.println(F("t temp | u hum | d test | r power cycle | s status | v version"));
	port.println(F("w/W (solo FTDI) sospendi 60 min / riattiva watchdog heartbeat"));
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
		if (readSensor()) port.println(lastTemp, 1); else port.println(F("ERR"));
		break;
	case 'u':
		if (readSensor()) port.println(lastHum, 1); else port.println(F("ERR"));
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

void scanI2C() {
	logPrefix();
	Serial.print(F("Scansione I2C:"));
	uint8_t found = 0;
	for (uint8_t addr = 1; addr < 127; addr++) {
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

	Serial.begin(9600);
	routerSerial.begin(9600);
	Wire.begin();
	Wire.setWireTimeout(25000, true); // evita blocchi del bus I2C

	Serial.println();
	logLine(F("Webcam Board fw " FW_VERSION " avviata"));
	printResetCause();
	scanI2C();
	sensorBegin();
	readSensor();

	lastHeartbeat = millis();
	lastStatusLog = millis();

	printStatus(Serial);
	logLine(F("Pronto. Digita ? per l'elenco comandi."));

	wdt_enable(WDTO_8S);
}

void loop() {
	wdt_reset();
	unsigned long now = millis();

	// Comandi dal router e dalla porta FTDI, un carattere alla volta
	while (routerSerial.available())
		processCommand((char)routerSerial.read(), routerSerial, true);
	while (Serial.available())
		processCommand((char)Serial.read(), Serial, false);

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
	if (now - lastSensorRead >= SENSOR_INTERVAL) {
		if (!readSensor() && now - lastSensorOk >= SENSOR_INTERVAL * 6)
			sensorBegin(); // prova a reinizializzarlo ogni minuto circa
		if (outputs[OUT_HEATING].on) {
			if (sensorOk && lastTemp > HEATER_MAX_TEMP)
				setOutput(OUT_HEATING, false, F("protezione: temperatura oltre 45 C"));
			else if (!sensorOk && now - lastSensorOk > SENSOR_FAIL_TIMEOUT)
				setOutput(OUT_HEATING, false, F("protezione: sensore non disponibile"));
		}
	}

	// Riga di stato periodica sul debug
	if (now - lastStatusLog >= STATUS_LOG_INTERVAL) {
		lastStatusLog = now;
		logPrefix();
		printStatus(Serial);
	}
}
