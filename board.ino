#include <Wire.h>
#include <SoftwareSerial.h>
#include "Adafruit_SHT31.h"

SoftwareSerial WebcamSerial(6, 7); // RX, TX
Adafruit_SHT31 sht31 = Adafruit_SHT31();

const unsigned long HEARTBEAT_TIMEOUT = 600000; // 10 minuti in millisecondi
unsigned long lastHeartbeatTime = 0;

void setup() {
	Wire.begin();
	Serial.begin(9600);
	WebcamSerial.begin(9600);
	
	// Inizializzazione del sensore con controllo errori
	if (!sht31.begin(0x44)) {
		Serial.println("ERRORE: Sensore SHT31 non trovato!");
		WebcamSerial.println("ERRORE: Sensore SHT31 non trovato!");
	} else {
		Serial.println("Sensore SHT31 inizializzato correttamente");
		WebcamSerial.println("Sensore SHT31 inizializzato correttamente");
	}
	
	lastHeartbeatTime = millis(); // Inizializza il timer all'avvio
	
	pinMode(2, OUTPUT); // sets pin 2 as output for Camera Power
	pinMode(3, OUTPUT); // sets pin 3 as output for Heating
	pinMode(4, OUTPUT); // sets pin 4 as output for PC
	pinMode(5, OUTPUT); // sets pin 5 as output for Fan
	
	delay(1000); // let serial console settle
	Serial.println("Sistema inizializzato");
	WebcamSerial.println("Sistema inizializzato");
}

void loop() {
	// Controllo del timeout dell'heartbeat
	// Se non riceve un segnale di Heartbeat da 10 minuti resetta il PC
	if (millis() - lastHeartbeatTime > HEARTBEAT_TIMEOUT) {
		resetFunc();
	}	
	
	// Gestione comandi da WebcamSerial
	if (WebcamSerial.available()) {
		String command = WebcamSerial.readString();
		processCommand(command, WebcamSerial);
	}
	
	// Gestione comandi da Serial
	if (Serial.available()) {
		String command = Serial.readString();
		processCommand(command, Serial);
	}
}

void processCommand(String command, Stream& serialPort) {
	if (command == "b") { // Heartbeat signal
		lastHeartbeatTime = millis();
		
	} else if (command == "C") {  // turn on Camera
		digitalWrite(2, LOW);
		
	} else if (command == "c") {  // turn off Camera
		digitalWrite(2, HIGH);
		
	} else if (command == "H") {  // turn on Heating
		digitalWrite(3, HIGH);
		
	} else if (command == "h") {  // turn off Heating
		digitalWrite(3, LOW);
		
	} else if (command == "P") {  // turn on PC
		digitalWrite(4, LOW);
		
	} else if (command == "p") {  // turn off PC
		digitalWrite(4, HIGH);
		
	} else if (command == "F") {  // turn on Fan
		digitalWrite(5, HIGH);
		
	} else if (command == "f") {  // turn off Fan
		digitalWrite(5, LOW);
		
	} else if (command == "t") {  // Lettura temperatura
		float t_celsius = sht31.readTemperature();
		if (!isnan(t_celsius)) {
			serialPort.print(t_celsius, 1);
		} 
		
	} else if (command == "u") {  // Lettura umidità
		float h_percent = sht31.readHumidity();
		if (!isnan(h_percent)) {
			serialPort.print(h_percent, 1);
		} 
		
	} else if (command == "d") {  // Debug connection
			serialPort.print("OK");
		
	}   
}

void resetFunc() {
	digitalWrite(4, HIGH);
	lastHeartbeatTime = millis();
	delay(1000);
	digitalWrite(4, LOW);
	Serial.println("Reset PC completato");
	WebcamSerial.println("Reset PC completato");
}
