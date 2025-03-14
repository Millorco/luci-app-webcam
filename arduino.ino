#include <Wire.h>

#include "SHTSensor.h"

SHTSensor sht;
// To use a specific sensor instead of probing the bus use this command:
// SHTSensor sht(SHTSensor::SHT3X);

const unsigned long HEARTBEAT_TIMEOUT = 600000; // 10 minuti in millisecondi
unsigned long lastHeartbeatTime = 0;
String inputString = "";


void setup() {
	Wire.begin();
	Serial.begin(115200);
	lastHeartbeatTime = millis(); // Inizializza il timer all'avvio
	pinMode(2, OUTPUT); // sets pin 2 as output for Camera Power
	pinMode(3, OUTPUT); // sets pin 3 as output for Heating
	pinMode(4, OUTPUT); // sets pin 4 as output for PC
	pinMode(5, OUTPUT); // sets pin 5 as output for Fun
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
	if (Serial.available()) {  // check for incoming serial data
		String command = Serial.readString();  // read command from serial port
		if (command == "PING") { // Heartbeat signal
			lastHeartbeatTime = millis();
			
	} else if (command == "camera_on") {  // turn on Camera
			digitalWrite(2, HIGH);
	} else if (command == "camera_off") {  // turn off Camera
			digitalWrite(2, LOW);
	} else if (command == "heating_on") {  // turn on Heating
			digitalWrite(3, HIGH);
	} else if (command == "heating_off") {  // turn off Heating
			digitalWrite(3, LOW);
	} else if (command == "pc_on") {  // turn on Heating
			digitalWrite(4, HIGH);
	} else if (command == "pc_off") {  // turn off Heating
			digitalWrite(4, LOW);
	} else if (command == "fun_on") {  // turn on Fun
			digitalWrite(5, HIGH);
	} else if (command == "fun_off") {  // turn off Fun
			digitalWrite(5, LOW);
	} else if (command == "test_on") {  // turn on LED
			digitalWrite(13, HIGH);
	} else if (command == "test_off") {  // turn off LED
			digitalWrite(13, LOW);
	} else if (command == "read_T") {  // read and send A0 analog value
      sht.readSample();
      Serial.print(sht.getHumidity(), 2);
      Serial.print(" ");
      Serial.print(sht.getTemperature(), 2);
      Serial.print("\n");
      }
   }
}

void resetFunc() {
			digitalWrite(4, HIGH);
			delay(1000);
			digitalWrite(4, LOW);
}
