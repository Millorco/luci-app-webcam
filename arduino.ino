#include <Wire.h>
#include "SHTSensor.h"
#include <SoftwareSerial.h>

SoftwareSerial PCSerial(10, 11); // RX, TX

SHTSensor sht;
// To use a specific sensor instead of probing the bus use this command:
// SHTSensor sht(SHTSensor::SHT3X);

const unsigned long HEARTBEAT_TIMEOUT = 600000; // 10 minuti in millisecondi
unsigned long lastHeartbeatTime = 0;
String inputString = "";


void setup() {
	Wire.begin();
	Serial.begin(115200);
	PCSerial.begin(115200);
	lastHeartbeatTime = millis(); // Inizializza il timer all'avvio
	pinMode(2, OUTPUT); // sets pin 2 as output for Camera Power
	pinMode(3, OUTPUT); // sets pin 3 as output for Heating
	pinMode(4, OUTPUT); // sets pin 4 as output for PC
	pinMode(5, OUTPUT); // sets pin 5 as output for Fun
	pinMode(10, OUTPUT); // sets pin 10 as output TEST
	pinMode(13, OUTPUT); // sets pin 13 as output TEST
	
	delay(1000); // let serial console settle

	if (sht.init()) {
		Serial.print("init(): success\n");
	} else {
		Serial.print("init(): failed\n");
	}
	sht.setAccuracy(SHTSensor::SHT_ACCURACY_MEDIUM); // only supported by SHT3x
}


void loop() {
	
	// Controllo del timeout dell'heartbeat
	if (millis() - lastHeartbeatTime > HEARTBEAT_TIMEOUT) {
	// Se non riceve un segnale di Heartbeat da 10 minuti resettta in PC
		resetFunc(); //funzione di reset del PC
	}	
	
	// Read and execute commands from serial port
	if (PCSerial.available()) {  // check for incoming serial data
		String command = PCSerial.readString();  // read command from serial port
	
	if (command == "p") { // Heartbeat signal
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
	} else if (command == "F") {  // turn on Fun
			digitalWrite(5, HIGH);
	} else if (command == "f") {  // turn off Fun
			digitalWrite(5, LOW);
	} else if (command == "X") {  // turn on TEST
			digitalWrite(10, HIGH);
	} else if (command == "x") {  // turn off TEST
			digitalWrite(10, LOW);
	} else if (command == "T") {  // turn on LED
			digitalWrite(13, HIGH);
	} else if (command == "t") {  // turn off LED
			digitalWrite(13, LOW);
	} else if (command == "r") {  // read and send Temp sensor
		sht.readSample();
		PCSerial.print(sht.getHumidity(), 2);
		PCSerial.print(" ");
		PCSerial.print(sht.getTemperature(), 2);
		PCSerial.print("\n");
		}
	}
}

void resetFunc() {
			digitalWrite(4, HIGH);
			lastHeartbeatTime = millis();
			delay(1000);
			digitalWrite(4, LOW);
}
